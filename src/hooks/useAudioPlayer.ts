import { useCallback, useEffect, useRef } from 'react'

import * as Tone from 'tone'

import { DRUM_MAP } from '../constants/drum'
import { PIANO_MAP } from '../constants/piano'
import type { NoteEvent } from '../lib/musicXmlParser'
import { useScoreStore } from '../stores/useScoreStore'

export const useAudioPlayer = (parsedEvents: NoteEvent[]) => {
  const samplers = useRef<Record<string, Tone.Sampler>>({})
  const isPlaying = useScoreStore((state) => state.isPlaying)
  const setIsPlaying = useScoreStore((state) => state.setIsPlaying)
  const partRef = useRef<Tone.Part | null>(null)

  const ticksToSeconds = useCallback((ticks: number) => {
    return Tone.Time(`${ticks}i`).toSeconds()
  }, [])

  useEffect(() => {
    const instrumentConfigs = [
      { id: 'piano', urls: PIANO_MAP, baseUrl: '/sounds/piano/' },
      { id: 'drum', urls: DRUM_MAP, baseUrl: '/sounds/drums/' },
      {
        id: 'clap',
        urls: { C4: 'Clap.wav' },
        baseUrl: '/sounds/clap/',
      },
    ]

    instrumentConfigs.forEach((config) => {
      samplers.current[config.id] = new Tone.Sampler({
        urls: config.urls,
        baseUrl: config.baseUrl,
      }).toDestination()
    })

    const currentSamplers = samplers.current

    return () => {
      Object.values(currentSamplers).forEach((s) => s.dispose())
    }
  }, [])

  // parsedEvents から Tone.Part を構築
  useEffect(() => {
    if (partRef.current) {
      partRef.current.dispose()
      partRef.current = null
    }

    const partEvents = parsedEvents.map((event) => ({
      time: ticksToSeconds(event.time),
      event,
    }))

    partRef.current = new Tone.Part((time, value) => {
      const { event } = value
      if (event.isRest || event.isTieContinuation) return

      const samplerId = event.samplerId
      const sampler = samplers.current[samplerId] ?? samplers.current.piano

      if (sampler.loaded) {
        sampler.triggerAttackRelease(
          event.playbackKey,
          ticksToSeconds(event.duration),
          time
        )
      }
    }, partEvents)

    partRef.current.start(0)

    return () => {
      partRef.current?.dispose()
    }
  }, [parsedEvents, ticksToSeconds])

  // isPlaying に応じて Transport の開始/停止を同期
  useEffect(() => {
    if (isPlaying) {
      Tone.getTransport().start()
    } else {
      Tone.getTransport().stop()
      Object.values(samplers.current).forEach((s) => s.releaseAll())
    }
  }, [isPlaying])

  const play = useCallback(async () => {
    await Tone.start()
    setIsPlaying(true)
  }, [setIsPlaying])

  const stop = useCallback(() => {
    setIsPlaying(false)
  }, [setIsPlaying])

  const playNote: PlayNoteFn = useCallback(
    (samplerId, playbackKey, durationBeats) => {
      const sampler = samplers.current[samplerId] ?? samplers.current.piano
      if (!sampler || !sampler.loaded) return

      const durationSeconds = durationBeats * Tone.Time('4n').toSeconds()

      sampler.triggerAttackRelease(playbackKey, durationSeconds, Tone.now())
    },
    []
  )

  return { play, stop, playNote }
}

export type PlayNoteFn = (
  samplerId: string,
  playbackKey: string | number,
  durationBeats: number
) => void

// React 型を使わず構造的に表現
export const createPlayNote = (samplersRef: {
  current: Record<string, Tone.Sampler> | undefined | null
}): PlayNoteFn => {
  return (samplerId, playbackKey, durationBeats) => {
    const sampler =
      samplersRef.current?.[samplerId] ?? samplersRef.current?.piano
    if (!sampler || !sampler.loaded) return
    const durationSeconds = durationBeats * Tone.Time('4n').toSeconds()
    sampler.triggerAttackRelease(playbackKey, durationSeconds, Tone.now())
  }
}
