import { useCallback, useEffect, useRef } from 'react'

import * as Tone from 'tone'

import { DRUM_MAP } from '../constants/drum'
import { PIANO_MAP } from '../constants/piano'
import type { NoteEvent } from '../lib/musicXmlParser'
import { useScoreStore } from '../stores/useScoreStore'

type AudioPlayerOptions = {
  onNoteStart?: (event: NoteEvent) => void
  onPlaybackStart?: (startTicks: number) => void
  onPlaybackStop?: () => void
}

export const useAudioPlayer = (
  parsedEvents: NoteEvent[],
  options: AudioPlayerOptions = {}
) => {
  const samplers = useRef<Record<string, Tone.Sampler>>({})
  const isPlaying = useScoreStore((state) => state.isPlaying)
  const setIsPlaying = useScoreStore((state) => state.setIsPlaying)
  const partRef = useRef<Tone.Part | null>(null)
  const onNoteStartRef = useRef(options.onNoteStart)
  const onPlaybackStartRef = useRef(options.onPlaybackStart)
  const onPlaybackStopRef = useRef(options.onPlaybackStop)
  const hasObservedPlaybackStateRef = useRef(false)

  useEffect(() => {
    onNoteStartRef.current = options.onNoteStart
    onPlaybackStartRef.current = options.onPlaybackStart
    onPlaybackStopRef.current = options.onPlaybackStop
  }, [options.onNoteStart, options.onPlaybackStart, options.onPlaybackStop])

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

      Tone.getDraw().schedule(() => {
        onNoteStartRef.current?.(event)
      }, time)

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
      const startTicks = Math.max(
        0,
        useScoreStore.getState().highlightedNoteTime ?? 0
      )
      const startSeconds = ticksToSeconds(startTicks)

      onPlaybackStartRef.current?.(startTicks)
      Tone.getTransport().start(undefined, startSeconds)
    } else {
      Tone.getDraw().cancel()
      Tone.getTransport().stop()
      Object.values(samplers.current).forEach((s) => s.releaseAll())
      if (hasObservedPlaybackStateRef.current) {
        onPlaybackStopRef.current?.()
      }
    }
    hasObservedPlaybackStateRef.current = true
  }, [isPlaying, ticksToSeconds])

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
