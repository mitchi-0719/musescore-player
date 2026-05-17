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
  private transport: any = null
  private part: any = null
  private synth: any = null
  private events: NoteEvent[] = []
  private isPlayingFlag = false
  private offset = 0
  private rafId: number | null = null
  private callbacks: Set<(t: number) => void> = new Set()

  constructor(tone: any, musicXml: string) {
    // Normalize dynamic import shape: some bundlers return { default: Tone } or the Tone namespace directly
    const T =
      tone && tone.Transport ? tone : tone && tone.default ? tone.default : tone
    this.tone = T

    const { events, tempo } = parseMusicXml(musicXml)
    this.events = events

    // Update store with measures and notes metadata
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

    this.transport = resolveTransport(this.tone)
    if (this.transport && this.transport.bpm) {
      this.transport.bpm.value = tempo
    }

    // create synth with fallbacks for different Tone.js exports
    try {
      const PolySynthClass =
        (this.tone && this.tone.PolySynth) ||
        (this.tone && (this.tone as any).PolyphonicSynth) ||
        null

      if (PolySynthClass && typeof PolySynthClass === 'function') {
        this.synth = new PolySynthClass(this.tone.Synth).toDestination()
      } else if (
        this.tone &&
        this.tone.Synth &&
        typeof this.tone.Synth === 'function'
      ) {
        // fallback to a single Synth if PolySynth is not available
        // create a very small poly-like wrapper by reusing Synth for each note
        this.synth = new this.tone.Synth().toDestination()
      } else {
        // last-resort no-op synth
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

    // Create a Part if available, otherwise schedule events on Transport
    if (this.tone && typeof this.tone.Part === 'function') {
      this.part = new this.tone.Part((time: number, ev: NoteEvent) => {
        const note = midiToNoteName(ev.midi)
        try {
          this.synth?.triggerAttackRelease(note as any, ev.duration, time)
        } catch (e) {
          // ignore
        }
      }, events as any)

      this.part.start(0)
      this.part.loop = false
    } else {
      // schedule events manually on Transport as a fallback
      const scheduledIds: any[] = []
      const scheduleAll = () => {
        try {
          if (
            !this.transport ||
            typeof this.transport.schedule !== 'function'
          ) {
            return
          }
          for (const ev of events) {
            // schedule callback at ev.time seconds
            const id = this.transport.schedule((time: number) => {
              try {
                const note = midiToNoteName(ev.midi)
                this.synth?.triggerAttackRelease(note as any, ev.duration, time)
              } catch (e) {}
            }, ev.time)
            scheduledIds.push(id)
          }
        } catch (e) {
          // ignore scheduling errors
        }
      }

      this.part = {
        start: () => scheduleAll(),
        stop: () => {
          try {
            // cancel all scheduled events
            this.transport?.cancel?.(0)
          } catch (e) {}
        },
        dispose: () => {},
      } as any
    }
  }

  async play() {
    try {
      await this.tone.start()
    } catch (e) {
      // Audio context may already be started
    }

    if (!this.isPlayingFlag) {
      try {
        if (!this.transport || typeof this.transport.start !== 'function') {
          throw new Error('transport unavailable')
        }
        this.transport.start(undefined, this.offset)
        this.isPlayingFlag = true
        this.part?.start?.(0)
        this.scheduleLoop()
      } catch (e) {
        console.error('Failed to start playback:', e)
        throw new Error('再生に失敗しました。もう一度お試しください。')
      }
    }
  }

  pause() {
    if (this.isPlayingFlag) {
      this.transport?.pause?.()
      this.isPlayingFlag = false
      this.offset = this.transport?.seconds ?? this.offset
      if (this.rafId) {
        cancelAnimationFrame(this.rafId)
        this.rafId = null
      }
    }
  }

  seek(time: number) {
    this.offset = Math.max(0, time)
    const wasPlaying = this.isPlayingFlag
    this.transport?.stop?.()
    if (wasPlaying) {
      this.transport?.start?.(undefined, this.offset)
    } else {
      // set transport position without starting
      if (this.transport) {
        this.transport.seconds = this.offset
      }
    }
    this.emitTime(this.offset)
  }

  setTempo(bpm: number) {
    if (bpm >= 40 && bpm <= 220) {
      if (this.transport?.bpm) {
        this.transport.bpm.value = bpm
      }
    }
  }

  getCurrentTime() {
    return this.isPlayingFlag
      ? (this.transport?.seconds ?? this.offset)
      : this.offset
  }

  onTimeUpdate(cb: (t: number) => void) {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  dispose() {
    try {
      this.part?.stop()
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
    } catch (e) {
      console.warn('Failed to play note:', e)
    }
  }

  private emitTime(t: number) {
    // Update highlighted measure based on current time
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
      const t = this.transport?.seconds ?? this.offset
      this.emitTime(t)
      if (this.isPlayingFlag) {
        this.rafId = requestAnimationFrame(loop)
      }
    }
    this.rafId = requestAnimationFrame(loop)
  }
}

function resolveTransport(tone: any) {
  return (
    tone?.Transport ||
    tone?.getTransport?.() ||
    tone?.context?.transport ||
    tone?.getContext?.()?.transport ||
    null
  )
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
