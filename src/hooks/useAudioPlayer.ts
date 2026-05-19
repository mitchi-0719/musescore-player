import { type RefObject, useCallback, useEffect, useRef } from 'react'

import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import * as Tone from 'tone'

import { DRUM_MAP } from '../constants/drum'
import { PIANO_MAP } from '../constants/piano'
import type { NoteEvent } from '../lib/musicXmlParser'

export const midiToNoteName = (midi: number) => {
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
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`
}

export const useAudioPlayer = (
  osmdRef: RefObject<OpenSheetMusicDisplay | null>,
  parsedEvents: NoteEvent[]
) => {
  const pianoSampler = useRef<Tone.Sampler | null>(null)
  const drumSampler = useRef<Tone.Sampler | null>(null)
  const toneRef = useRef<typeof Tone | null>(null)

  const isPlaying = useRef(false)
  const startTime = useRef<number>(0)
  const scheduledEventIndices = useRef<Set<number>>(new Set())

  useEffect(() => {
    let isMounted = true

    const initTone = async () => {
      try {
        if (!isMounted) return

        // Tone を保持するが、AudioContext の作成につながる Sampler は
        // ユーザー操作時（play）まで遅延して生成する。
        toneRef.current = Tone

        console.log('Tone.js loaded (samplers will be created on first play)')
      } catch (err) {
        console.error('Failed to initialize Tone.js:', err)
      }
    }

    initTone()

    return () => {
      isMounted = false
      pianoSampler.current?.dispose()
      drumSampler.current?.dispose()
    }
  }, [])

  const normalizePianoUrls = (map: Record<string, string>) => {
    const out: Record<string, string> = {}
    Object.entries(map).forEach(([k, v]) => {
      // convert Ds4 -> D#4 style (s -> # before digits)
      const nk = k.replace(/s(?=\d)/g, '#')
      out[nk] = v
    })
    return out
  }

  const normalizeDrumUrls = (map: Record<number, string>) => {
    const out: Record<string, string> = {}
    Object.entries(map).forEach(([k, v]) => {
      out[String(k)] = v
    })
    return out
  }

  const ensureSamplers = useCallback(async () => {
    const Tone = toneRef.current
    if (!Tone) return

    if (!pianoSampler.current) {
      const pianoUrls = normalizePianoUrls(PIANO_MAP)
      pianoSampler.current = new Tone.Sampler({
        urls: pianoUrls,
        baseUrl: '/sounds/piano/',
      }).toDestination()
    }

    if (!drumSampler.current) {
      const drumUrls = normalizeDrumUrls(DRUM_MAP)
      drumSampler.current = new Tone.Sampler({
        urls: drumUrls,
        baseUrl: '/sounds/drums/',
      }).toDestination()
    }
  }, [])

  const play = useCallback(async () => {
    const Tone = toneRef.current
    if (!Tone) return

    // AudioContext はユーザー操作の後に開始する必要がある
    if (typeof Tone.start === 'function') {
      try {
        await Tone.start()
      } catch (e) {
        console.warn('Tone start failed:', e)
      }
    }

    // start() 後に Sampler を生成（これで AudioContext の自動生成を避ける）
    try {
      await ensureSamplers()
    } catch (e) {
      console.warn('Failed to create samplers:', e)
    }

    isPlaying.current = true
    startTime.current = Tone.now()
    scheduledEventIndices.current.clear()

    if (osmdRef.current) {
      osmdRef.current.cursor.show()
    }
  }, [osmdRef, ensureSamplers])

  const stop = useCallback(() => {
    isPlaying.current = false
    pianoSampler.current?.releaseAll()
    drumSampler.current?.releaseAll()

    if (osmdRef.current) {
      osmdRef.current.cursor.hide()
    }
  }, [osmdRef])

  const playNote = useCallback(
    (midi: number, duration: string | number = '8n') => {
      const sampler = midi < 60 ? drumSampler.current : pianoSampler.current
      if (!sampler) return
      sampler.triggerAttackRelease(midiToNoteName(midi), duration)
    },
    []
  )

  const seek = useCallback((time: number) => {
    if (!toneRef.current) return
    startTime.current = toneRef.current.now() - time
    scheduledEventIndices.current.clear()
  }, [])

  useEffect(() => {
    if (!isPlaying.current || !toneRef.current) return

    let animationFrameId: number
    const update = () => {
      if (!isPlaying.current || !toneRef.current) return

      const elapsed = toneRef.current.now() - startTime.current

      parsedEvents.forEach((ev, index) => {
        if (!scheduledEventIndices.current.has(index) && elapsed >= ev.time) {
          playNote(ev.midi, ev.duration)
          scheduledEventIndices.current.add(index)

          if (osmdRef.current) {
            osmdRef.current.cursor.next()
          }
        }
      })

      animationFrameId = requestAnimationFrame(update)
    }

    animationFrameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrameId)
  }, [parsedEvents, playNote, osmdRef])

  return { play, stop, seek, playNote }
}
