'use client'

import { useRef } from 'react'

import { extractMeasuresAndNotes, getMeasureAtTime } from '@/lib/audioSync'
import { type PlayerHandle, useScoreStore } from '@/stores/useScoreStore'

export type NoteEvent = { time: number; duration: number; midi: number }

export function midiToNoteName(midi: number) {
  const names = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]
  const note = names[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

function parseMusicXml(musicXml: string) {
  const doc = new DOMParser().parseFromString(musicXml, 'application/xml')
  const part = doc.querySelector('part')
  const divisionsEl = doc.querySelector('divisions')
  const divisions = divisionsEl ? Number(divisionsEl.textContent || '1') : 1

  // try to find tempo
  let tempo = 120
  const sound = doc.querySelector('sound[tempo]')
  if (sound) {
    const t = Number(sound.getAttribute('tempo'))
    if (!Number.isNaN(t) && t > 0) tempo = t
  } else {
    const met = doc.querySelector('metronome per-minute')
    if (met && met.textContent) {
      const t = Number(met.textContent)
      if (!Number.isNaN(t) && t > 0) tempo = t
    }
  }

  const events: NoteEvent[] = []
  let currentTime = 0

  if (!part) return { events, tempo, total: 0 }

  const measures = Array.from(part.querySelectorAll('measure'))
  for (const measure of measures) {
    const notes = Array.from(measure.querySelectorAll('note'))
    for (const note of notes) {
      const isRest = !!note.querySelector('rest')
      const durationEl = note.querySelector('duration')
      const durationDiv = durationEl ? Number(durationEl.textContent || '0') : 0

      // pitch
      if (!isRest) {
        const step = note.querySelector('pitch > step')?.textContent || 'C'
        const alter = Number(
          note.querySelector('pitch > alter')?.textContent || '0'
        )
        const octave = Number(
          note.querySelector('pitch > octave')?.textContent || '4'
        )
        const stepMap: Record<string, number> = {
          C: 0,
          D: 2,
          E: 4,
          F: 5,
          G: 7,
          A: 9,
          B: 11,
        }
        const semitone =
          (stepMap[step.toUpperCase()] ?? 0) + (isNaN(alter) ? 0 : alter)
        const midi = (octave + 1) * 12 + semitone
        const durSec =
          divisions > 0 ? (durationDiv / divisions) * (60 / tempo) : 0
        events.push({ time: currentTime, duration: durSec, midi })
      }

      // chord handling: if <chord/> exists, do not advance time for this note
      const isChord = !!note.querySelector('chord')
      if (!isChord) {
        const advance =
          divisions > 0 ? (durationDiv / divisions) * (60 / tempo) : 0
        currentTime += advance
      }
    }
  }

  const total = currentTime
  return { events, tempo, total }
}

class ToneMusicPlayer implements PlayerHandle {
  private tone: any
  private part: any = null
  private synth: any = null
  private events: NoteEvent[] = []
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private isPlayingFlag = false
  private offset = 0
  private playbackStart = 0
  private nextEventIndex = 0
  private rafId: number | null = null
  private callbacks: Set<(t: number) => void> = new Set()

  constructor(tone: any, musicXml: string) {
    const T = tone && tone.default ? tone.default : tone
    this.tone = T

    const { events } = parseMusicXml(musicXml)
    this.events = [...events].sort((a, b) => a.time - b.time)

    try {
      const { measures, notes, totalDuration } =
        extractMeasuresAndNotes(musicXml)
      const state = useScoreStore.getState()
      state.setMeasures(measures)
      state.setNotes(notes)
      state.setTotalDuration(totalDuration)
    } catch (e) {
      console.warn('Failed to extract measures and notes:', e)
    }

    try {
      const PolySynthClass =
        this.tone?.PolySynth || this.tone?.PolyphonicSynth || null
      if (PolySynthClass && typeof PolySynthClass === 'function') {
        this.synth = new PolySynthClass(this.tone.Synth).toDestination()
      } else if (this.tone?.Synth && typeof this.tone.Synth === 'function') {
        this.synth = new this.tone.Synth().toDestination()
      } else {
        this.synth = { triggerAttackRelease: () => {} } as any
      }
    } catch (e) {
      console.warn('Synth creation fallback triggered:', e)
      try {
        this.synth = new this.tone.Synth().toDestination()
      } catch (e2) {
        this.synth = { triggerAttackRelease: () => {} } as any
      }
    }

    this.initializeWebAudio()
  }

  async play() {
    try {
      await this.tone.start()
    } catch (e) {
      // Audio context may already be started
    }

    await this.resumeWebAudio()

    if (this.isPlayingFlag) {
      return
    }

    try {
      this.isPlayingFlag = true
      this.playbackStart =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
        this.offset * 1000
      this.nextEventIndex = this.findNextEventIndex(this.offset)
      this.scheduleLoop()
    } catch (e) {
      console.error('Failed to start playback:', e)
      throw new Error('再生に失敗しました。もう一度お試しください。')
    }
  }

  pause() {
    if (!this.isPlayingFlag) return

    this.offset = this.getElapsedSeconds()
    this.isPlayingFlag = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  seek(time: number) {
    this.offset = Math.max(0, time)
    this.nextEventIndex = this.findNextEventIndex(this.offset)

    if (this.isPlayingFlag) {
      this.playbackStart =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
        this.offset * 1000
    }

    this.emitTime(this.offset)
  }

  setTempo(bpm: number) {
    if (bpm >= 40 && bpm <= 220) {
      useScoreStore.getState().setTempo(bpm)
    }
  }

  getCurrentTime() {
    return this.isPlayingFlag ? this.getElapsedSeconds() : this.offset
  }

  onTimeUpdate(cb: (t: number) => void) {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  dispose() {
    try {
      this.part?.dispose()
    } catch (e) {}
    try {
      this.synth?.dispose()
    } catch (e) {}
    this.part = null
    this.synth = null
    this.isPlayingFlag = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.callbacks.clear()
  }

  playNote(note: string | number, duration = 0.5) {
    try {
      const noteName = typeof note === 'number' ? midiToNoteName(note) : note
      this.synth?.triggerAttackRelease(
        noteName as any,
        duration,
        this.tone.now()
      )
      if (typeof note === 'number') {
        this.playMidiTone(note, duration)
      }
    } catch (e) {
      console.warn('Failed to play note:', e)
    }
  }

  private emitTime(t: number) {
    try {
      const state = useScoreStore.getState()
      const measNum = getMeasureAtTime(t, state.measures)
      if (measNum !== state.highlightedMeasureNumber) {
        state.setHighlightedMeasure(measNum)
      }
    } catch (e) {
      // Ignore errors in highlighting
    }

    this.callbacks.forEach((cb) => cb(t))
  }

  private scheduleLoop() {
    const loop = () => {
      const t = this.getElapsedSeconds()
      this.fireDueEvents(this.offset, t)
      this.offset = t
      this.emitTime(t)
      if (this.isPlayingFlag) {
        this.rafId = requestAnimationFrame(loop)
      }
    }

    this.rafId = requestAnimationFrame(loop)
  }

  private getElapsedSeconds() {
    if (!this.isPlayingFlag) {
      return this.offset
    }

    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    return Math.max(0, (now - this.playbackStart) / 1000)
  }

  private findNextEventIndex(time: number) {
    const index = this.events.findIndex((event) => event.time >= time)
    return index === -1 ? this.events.length : index
  }

  private fireDueEvents(fromTime: number, toTime: number) {
    while (this.nextEventIndex < this.events.length) {
      const event = this.events[this.nextEventIndex]
      if (event.time > toTime) break

      if (event.time >= fromTime) {
        const note = midiToNoteName(event.midi)
        try {
          this.synth?.triggerAttackRelease(note as any, event.duration)
        } catch (e) {
          console.warn('Failed to trigger note:', e)
        }
        this.playMidiTone(event.midi, event.duration)
      }

      this.nextEventIndex += 1
    }
  }

  private initializeWebAudio() {
    if (typeof window === 'undefined') return

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    try {
      this.audioContext = new AudioContextClass()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = 0.18
      this.masterGain.connect(this.audioContext.destination)
    } catch (error) {
      console.warn('WebAudio initialization failed:', error)
      this.audioContext = null
      this.masterGain = null
    }
  }

  private async resumeWebAudio() {
    if (!this.audioContext) return

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
    } catch (error) {
      console.warn('WebAudio resume failed:', error)
    }
  }

  private playMidiTone(midi: number, duration: number) {
    if (!this.audioContext || !this.masterGain) return

    const oscillator = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    const frequency = 440 * Math.pow(2, (midi - 69) / 12)
    const safeDuration = Math.max(0.08, Math.min(duration || 0.25, 2.5))
    const attack = 0.015
    const release = 0.05
    const now = this.audioContext.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.9, now + attack)
    gain.gain.setValueAtTime(
      0.9,
      now + Math.max(attack, safeDuration - release)
    )
    gain.gain.linearRampToValueAtTime(0, now + safeDuration)

    oscillator.connect(gain)
    gain.connect(this.masterGain)
    oscillator.start(now)
    oscillator.stop(now + safeDuration + 0.02)

    oscillator.onended = () => {
      try {
        oscillator.disconnect()
        gain.disconnect()
      } catch (error) {
        // ignore
      }
    }
  }
}

export async function initPlayerFromMusicXml(
  musicXml: string
): Promise<PlayerHandle> {
  try {
    const mod = await import('tone')
    const tone = (mod as any).default ?? mod

    // Ensure audio context and Transport are initialized
    if (typeof tone.start === 'function') {
      try {
        await tone.start()
      } catch (e) {
        // start may fail due to autoplay policy if not triggered by user gesture; ignore
      }
    }

    const p = new ToneMusicPlayer(tone, musicXml)
    return p
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : '音声再生の初期化に失敗しました'
    console.error('Player initialization error:', error)
    throw new Error(msg)
  }
}

export default function useAudioPlayer() {
  const playerRef = useRef<PlayerHandle | null>(null)
  const setPlayer = useScoreStore((s) => s.setPlayer)
  return {
    async createFromMusicXml(musicXml: string) {
      const p = await initPlayerFromMusicXml(musicXml)
      playerRef.current = p
      setPlayer(p)
      return p
    },
    get player() {
      return playerRef.current
    },
    dispose() {
      playerRef.current?.dispose()
      playerRef.current = null
      setPlayer(null)
    },
  }
}

export function parseMusicXmlForEvents(musicXml: string) {
  return parseMusicXml(musicXml)
}

// Initialize player from an OpenSheetMusicDisplay instance using osmd-audio-player
export async function initPlayerFromOsmd(
  osmdInstance: any
): Promise<PlayerHandle> {
  // Use osmd-audio-player to handle multi-part playback
  const PlaybackEngine = (await import('osmd-audio-player')).default

  const mapInstrumentNameToMidi = (name?: string | null) => {
    if (!name) return null
    const n = name.toLowerCase()
    if (n.includes('hand') && n.includes('clap')) return 126 // Applause
    if (n.includes('clap')) return 126
    if (n.includes('hand')) return 126
    if (n === 'vp' || n.includes('voice perc') || n.includes('voice percusion'))
      return 118
    if (n.includes('drum kit') || n.includes('drumset')) return 116 // Taiko Drum
    if (n.includes('perc') || n.includes('drum') || n.includes('drums'))
      return 116 // Taiko Drum
    if (n.includes('snare')) return 118
    if (n.includes('cymbal')) return 118
    return null
  }

  const clonePlaybackOsmd = (osmd: any) => {
    const sheet = osmd?.Sheet
    if (!sheet) return osmd

    const clonedSheet = {
      ...sheet,
      Instruments: Array.isArray(sheet.Instruments)
        ? sheet.Instruments.map((inst: any) => {
            const name =
              inst.InstrumentName ||
              inst.Name ||
              inst.ShortName ||
              inst.ScorePartName
            const mapped =
              inst.MidiInstrumentId === 128
                ? 116
                : mapInstrumentNameToMidi(name)

            const clonedInst = {
              ...inst,
            }

            clonedInst.MidiInstrumentId = inst.MidiInstrumentId ?? 0

            if (mapped != null) {
              clonedInst.MidiInstrumentId = mapped
            }

            if (Array.isArray(inst.SubInstruments)) {
              clonedInst.SubInstruments = inst.SubInstruments.map(
                (subInstrument: any) => ({
                  ...subInstrument,
                  fixedKey: mapped != null ? 0 : subInstrument.fixedKey,
                })
              )
            }

            if (Array.isArray(inst.Voices)) {
              clonedInst.Voices = inst.Voices.map((voice: any) => ({
                ...voice,
                midiInstrumentId:
                  mapped != null
                    ? mapped
                    : (voice.midiInstrumentId ?? clonedInst.MidiInstrumentId),
              }))
            }

            return clonedInst
          })
        : sheet.Instruments,
    }

    return {
      ...osmd,
      cursor: osmd.cursor,
      Sheet: clonedSheet,
    }
  }

  const playbackOsmd = clonePlaybackOsmd(osmdInstance)

  const scoreInst = playbackOsmd?.Sheet?.Instruments || []
  for (const inst of scoreInst) {
    const name =
      inst.InstrumentName || inst.Name || inst.ShortName || inst.ScorePartName
    const mapped =
      inst.MidiInstrumentId === 128 ? 116 : mapInstrumentNameToMidi(name)

    if (mapped == null) continue

    inst.MidiInstrumentId = mapped

    if (inst.SubInstruments && inst.SubInstruments.length > 0) {
      for (const subInstrument of inst.SubInstruments) {
        subInstrument.fixedKey = 0
      }
    }

    if (inst.Voices && inst.Voices.length > 0) {
      for (const voice of inst.Voices) {
        voice.midiInstrumentId = mapped
      }
    }
  }

  const audioPlayer = new PlaybackEngine()
  await audioPlayer.loadScore(playbackOsmd)

  // Adapter implementing PlayerHandle
  const callbacks = new Set<(t: number) => void>()
  let currentTime = 0
  let isPlaying = false
  let pollId: number | null = null

  const startPolling = () => {
    if (pollId != null) return
    pollId = window.setInterval(() => {
      try {
        callbacks.forEach((cb) => cb(currentTime))
      } catch (e) {
        console.warn('Polling error:', e)
      }
    }, 100)
  }

  const stopPolling = () => {
    if (pollId != null) {
      clearInterval(pollId)
      pollId = null
    }
  }

  try {
    const scoreInst = (audioPlayer as any).scoreInstruments || []
    for (const inst of scoreInst) {
      const name =
        inst.InstrumentName || inst.Name || inst.ShortName || inst.ScorePartName
      const mapped = mapInstrumentNameToMidi(name)
      if (mapped != null) {
        try {
          if (inst.SubInstruments && inst.SubInstruments.length > 0) {
            for (const subInstrument of inst.SubInstruments) {
              subInstrument.fixedKey = 0
            }
          }
        } catch (error) {
          console.warn(
            'Failed to normalize fixedKey for percussion instrument:',
            error
          )
        }

        // set for each voice in the instrument
        if (inst.Voices && inst.Voices.length > 0) {
          for (const v of inst.Voices) {
            try {
              // setInstrument expects a Voice and a midi id
              if (typeof audioPlayer.setInstrument === 'function') {
                // don't await to parallelize, but catch errors
                audioPlayer.setInstrument(v, mapped).catch((e: any) => {
                  console.warn('setInstrument failed for', name, e)
                })
              }
            } catch (e) {
              console.warn('Instrument mapping error:', e)
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Instrument auto-mapping failed:', e)
  }

  const instrumentPlayer = (audioPlayer as any).instrumentPlayer
  const originalSchedule = instrumentPlayer?.schedule?.bind(instrumentPlayer)

  if (originalSchedule) {
    instrumentPlayer.schedule = (
      midiId: number,
      time: number,
      notes: Array<{ note: number; duration: number; gain: number }>
    ) => {
      const safeMidiId = Number.isFinite(Number(midiId)) ? Number(midiId) : 0
      const playbackMidiId = safeMidiId === 128 ? 116 : safeMidiId
      const isPercussionPlayback =
        playbackMidiId === 116 ||
        playbackMidiId === 118 ||
        playbackMidiId === 126
      const normalizedNotes = notes.map((n) => {
        const pitch = Number(n.note)
        const roundedPitch = Number.isFinite(pitch) ? Math.round(pitch) : 60
        const safePitch = isPercussionPlayback
          ? Math.min(81, Math.max(35, roundedPitch))
          : Math.min(127, Math.max(1, roundedPitch))

        return {
          ...n,
          note: safePitch,
        }
      })

      return originalSchedule(playbackMidiId, time, normalizedNotes)
    }
  }

  // Monitor playback events to track current time
  if (typeof audioPlayer.on === 'function') {
    audioPlayer.on('iteration' as any, (step: any) => {
      if (
        audioPlayer.wholeNoteLength &&
        typeof step === 'object' &&
        step.index !== undefined
      ) {
        // Estimate current time based on steps
        const bpm = audioPlayer.playbackSettings?.bpm || 120
        const wholeNoteDuration = (4 * 60) / bpm // whole note duration in seconds
        currentTime = (step.index * wholeNoteDuration) / 16 // rough estimation
      }
    })
  }

  const originalNotePlaybackCallback = (
    audioPlayer as any
  ).notePlaybackCallback?.bind(audioPlayer)

  if (originalNotePlaybackCallback) {
    ;(audioPlayer as any).notePlaybackCallback = (
      audioDelay: number,
      notes: any[]
    ) => {
      for (const note of notes) {
        if (!note) continue
        const parentVoice = note?.ParentVoiceEntry?.ParentVoice
        if (
          parentVoice &&
          !Number.isFinite(Number(parentVoice.midiInstrumentId))
        ) {
          parentVoice.midiInstrumentId = Number.isFinite(
            Number(parentVoice?.Parent?.MidiInstrumentId)
          )
            ? Number(parentVoice.Parent.MidiInstrumentId)
            : 0
        }
        const pitch = Number(note.halfTone)

        // Keep original note instance intact and only sanitize pitch values.
        if (!Number.isFinite(pitch)) {
          note.halfTone = 60
        } else {
          note.halfTone = Math.min(108, Math.max(12, Math.round(pitch)))
        }
      }

      return originalNotePlaybackCallback(audioDelay, notes)
    }
  }
  const adapter: PlayerHandle = {
    async play() {
      try {
        await audioPlayer.play()
        isPlaying = true
        startPolling()
      } catch (error) {
        console.error('Play error:', error)
        throw error
      }
    },

    pause() {
      try {
        audioPlayer.pause()
        isPlaying = false
        stopPolling()
      } catch (error) {
        console.warn('Pause error:', error)
      }
    },

    seek(time: number) {
      try {
        // PlaybackEngine doesn't have a setCurrentTime method
        // Try jumpToStep as an alternative
        if (typeof (audioPlayer as any).jumpToStep === 'function') {
          ;(audioPlayer as any).jumpToStep(Math.floor(time * 16))
        }
        currentTime = time
      } catch (error) {
        console.warn('Seek error:', error)
      }
    },

    setTempo(bpm: number) {
      try {
        if (audioPlayer.playbackSettings) {
          audioPlayer.playbackSettings.bpm = bpm
        }
      } catch (error) {
        console.warn('SetTempo error:', error)
      }
    },

    getCurrentTime() {
      return currentTime
    },

    onTimeUpdate(callback: (time: number) => void) {
      callbacks.add(callback)
      return () => callbacks.delete(callback)
    },

    playNote() {
      // osmd-audio-player doesn't support single note playback
      console.warn('playNote not supported with osmd-audio-player')
    },

    dispose() {
      try {
        stopPolling()
        if (typeof audioPlayer.stop === 'function') {
          audioPlayer.stop()
        }
      } catch (error) {
        console.warn('Dispose error:', error)
      }
    },
  }

  return adapter
}

export async function initPlayerFromMusicXmlUsingOsmd(
  musicXml: string
): Promise<PlayerHandle> {
  const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
  const container = document.createElement('div')
  container.style.display = 'none'
  document.body.appendChild(container)

  const osmd = new OpenSheetMusicDisplay(container, {
    autoResize: true,
  })

  try {
    await osmd.load(musicXml)
    osmd.render()
    return initPlayerFromOsmd(osmd)
  } catch (error) {
    container.remove()
    throw error
  }
}
