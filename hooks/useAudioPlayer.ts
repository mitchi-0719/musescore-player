'use client'

import { useRef } from 'react'

import { extractMeasuresAndNotes, getMeasureAtTime } from '@/lib/audioSync'
import { type PlayerHandle, useScoreStore } from '@/stores/useScoreStore'

type NoteEvent = { time: number; duration: number; midi: number }

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
  const mod = await import('osmd-audio-player')
  const pkg: any = (mod as any).default ?? mod

  // Try to find constructor
  const PlayerClass = pkg.OSMDAudioPlayer ?? pkg.default ?? pkg

  let inner: any = null
  try {
    inner = new PlayerClass(osmdInstance)
  } catch (e) {
    // fallback: if constructor signature differs, try factory
    if (typeof pkg.create === 'function') inner = await pkg.create(osmdInstance)
  }

  // Adapter implementing PlayerHandle
  const callbacks = new Set<(t: number) => void>()
  let pollId: number | null = null

  const startPolling = () => {
    if (pollId != null) return
    pollId = window.setInterval(() => {
      try {
        const t = (inner && inner.getCurrentTime && inner.getCurrentTime()) || 0
        callbacks.forEach((cb) => cb(t))
      } catch (e) {}
    }, 100)
  }

  const stopPolling = () => {
    if (pollId != null) {
      clearInterval(pollId)
      pollId = null
    }
  }

  const adapter: PlayerHandle = {
    async play() {
      if (!inner) return
      if (inner.play) await inner.play()
      startPolling()
    },
    pause() {
      if (!inner) return
      if (inner.pause) inner.pause()
      stopPolling()
    },
    seek(time: number) {
      if (!inner) return
      if (inner.seek) inner.seek(time)
      else if (inner.setPosition) inner.setPosition(time)
    },
    setTempo(bpm: number) {
      if (!inner) return
      if (inner.setTempo) inner.setTempo(bpm)
      else if (inner.transport && inner.transport.bpm)
        inner.transport.bpm.value = bpm
    },
    getCurrentTime() {
      try {
        return (
          (inner &&
            ((inner.getCurrentTime && inner.getCurrentTime()) ||
              (inner.getPosition && inner.getPosition()))) ||
          0
        )
      } catch (e) {
        return 0
      }
    },
    onTimeUpdate(cb: (t: number) => void) {
      callbacks.add(cb)
      startPolling()
      return () => {
        callbacks.delete(cb)
        if (callbacks.size === 0) stopPolling()
      }
    },
    dispose() {
      try {
        stopPolling()
        if (inner && inner.dispose) inner.dispose()
      } catch (e) {}
    },
    playNote(note: string | number, duration = 0.5) {
      try {
        if (!inner) return
        if (inner.playNote) inner.playNote(note, duration)
      } catch (e) {}
    },
  }

  return adapter
}
