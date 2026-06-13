import { type RefObject, useCallback, useEffect, useRef } from 'react'

import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import * as Tone from 'tone'

import { DRUM_MAP } from '../constants/drum'
import { PIANO_MAP } from '../constants/piano'
import type { NoteEvent } from '../lib/musicXmlParser'
import { useScoreStore } from '../stores/useScoreStore'

export const useAudioPlayer = (
  osmdInstance: RefObject<OpenSheetMusicDisplay | null>,
  parsedEvents: NoteEvent[]
) => {
  const samplers = useRef<Record<string, Tone.Sampler>>({})
  const isPlaying = useScoreStore((state) => state.isPlaying)
  const setIsPlaying = useScoreStore((state) => state.setIsPlaying)
  const startTime = useRef(0)
  const playedIndices = useRef(new Set<number>())

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

  const play = useCallback(async () => {
    await Tone.start()
    startTime.current = Tone.now()
    setIsPlaying(true)
    playedIndices.current.clear()
  }, [setIsPlaying])

  const stop = useCallback(() => {
    setIsPlaying(false)
  }, [setIsPlaying])

  const playNote = useCallback(
    (samplerId: string, playbackKey: string, durationTicks: number) => {
      const sampler = samplers.current[samplerId] ?? samplers.current.piano
      if (!sampler || !sampler.loaded) return

      sampler.triggerAttackRelease(
        playbackKey,
        ticksToSeconds(durationTicks),
        Tone.now()
      )
    },
    [ticksToSeconds]
  )

  useEffect(() => {
    if (!isPlaying) return

    let frameId: number

    const loop = () => {
      if (!isPlaying) return
      const elapsed = Tone.now() - startTime.current

      parsedEvents.forEach((event, index) => {
        const eventStart = ticksToSeconds(event.time)

        if (!playedIndices.current.has(index) && elapsed >= eventStart) {
          playedIndices.current.add(index)

          // 休符・タイ継続はインデックスだけ消費して音は鳴らさない
          if (event.isRest || event.isTieContinuation) return

          const samplerId = event.samplerId
          const sampler = samplers.current[samplerId] ?? samplers.current.piano

          if (sampler.loaded) {
            const noteToPlay = event.playbackKey

            sampler.triggerAttackRelease(
              noteToPlay,
              ticksToSeconds(event.duration),
              Tone.now()
            )
          }
        }
      })
      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [isPlaying, parsedEvents, osmdInstance, ticksToSeconds])

  return { play, stop, playNote }
}

export type PlayNoteFn = (
  samplerId: string,
  playbackKey: string,
  durationTicks: number
) => void

// React 型を使わず構造的に表現
export const createPlayNote = (
  samplersRef: { current: Record<string, Tone.Sampler> | undefined | null },
  ticksToSecondsFn: (t: number) => number
): PlayNoteFn => {
  return (samplerId, playbackKey, durationTicks) => {
    const sampler =
      samplersRef.current?.[samplerId] ?? samplersRef.current?.piano
    if (!sampler || !sampler.loaded) return
    sampler.triggerAttackRelease(
      playbackKey,
      ticksToSecondsFn(durationTicks),
      Tone.now()
    )
  }
}
