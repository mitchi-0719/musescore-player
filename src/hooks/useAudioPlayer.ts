import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

export type AudioPartControl = {
  id: string
  name: string
  volume: number
  isMuted: boolean
  isSoloed: boolean
}

export type AudioMixerControls = {
  parts: AudioPartControl[]
  masterVolume: number
  metronomeVolume: number
  isMetronomeMuted: boolean
  isMetronomeSoloed: boolean
  soloPart: (partId: string) => void
  clearSoloPart: () => void
  mutePart: (partId: string) => void
  unmutePart: (partId: string) => void
  setPartVolume: (partId: string, volume: number) => void
  muteAll: () => void
  unmuteAll: () => void
  setMasterVolume: (volume: number) => void
  setMetronomeVolume: (volume: number) => void
  muteMetronome: () => void
  unmuteMetronome: () => void
  soloMetronome: () => void
  clearMetronomeSolo: () => void
}

type PartMixerState = {
  volume: number
  isMuted: boolean
}

type MixerState = {
  masterVolume: number
  metronomeVolume: number
  soloPartId: string | null
  metronomeMuted: boolean
  metronomeSoloed: boolean
  parts: Record<string, PartMixerState>
}

const DEFAULT_VOLUME = 1
const MAX_VOLUME = 2
const TICKS_PER_QUARTER = 192
const DEFAULT_MEASURE_TICKS = TICKS_PER_QUARTER * 4
const METRONOME_ACCENT_NOTE = 'C6'
const METRONOME_BEAT_NOTE = 'C5'
const METRONOME_BEAT_VOLUME_MULTIPLIER = 0.7
// ミキサーの表示値は維持したまま、ドラム音源の出力だけを少し抑える。
const DRUM_VOLUME_MULTIPLIER = 0.8
const clampVolume = (volume: number) =>
  Math.min(MAX_VOLUME, Math.max(0, volume))
const getSamplerVolumeMultiplier = (samplerId: string) =>
  samplerId === 'drum' ? DRUM_VOLUME_MULTIPLIER : 1
const getDefaultPartState = (): PartMixerState => ({
  volume: DEFAULT_VOLUME,
  isMuted: false,
})

export const useAudioPlayer = (
  parsedEvents: NoteEvent[],
  options: AudioPlayerOptions = {}
) => {
  const samplers = useRef<Record<string, Tone.Sampler>>({})
  const metronomeSynthRef = useRef<Tone.Synth | null>(null)
  const metronomeLoopRef = useRef<Tone.Loop | null>(null)
  const isPlaying = useScoreStore((state) => state.isPlaying)
  const setIsPlaying = useScoreStore((state) => state.setIsPlaying)
  const setStoreVolume = useScoreStore((state) => state.setVolume)
  const partRef = useRef<Tone.Part | null>(null)
  const onNoteStartRef = useRef(options.onNoteStart)
  const onPlaybackStartRef = useRef(options.onPlaybackStart)
  const onPlaybackStopRef = useRef(options.onPlaybackStop)
  const hasObservedPlaybackStateRef = useRef(false)
  const activePartIdsRef = useRef<Set<string>>(new Set())
  const measureStartTicksRef = useRef<Set<number>>(new Set())
  const [mixerState, setMixerState] = useState<MixerState>({
    masterVolume: DEFAULT_VOLUME,
    metronomeVolume: DEFAULT_VOLUME,
    soloPartId: null,
    metronomeMuted: false,
    metronomeSoloed: false,
    parts: {},
  })
  const mixerStateRef = useRef(mixerState)

  useEffect(() => {
    mixerStateRef.current = mixerState
  }, [mixerState])

  useEffect(() => {
    onNoteStartRef.current = options.onNoteStart
    onPlaybackStartRef.current = options.onPlaybackStart
    onPlaybackStopRef.current = options.onPlaybackStop
  }, [options.onNoteStart, options.onPlaybackStart, options.onPlaybackStop])

  const ticksToSeconds = useCallback((ticks: number) => {
    return Tone.Time(`${ticks}i`).toSeconds()
  }, [])

  const partDescriptors = useMemo(() => {
    const parts = new Map<string, string>()

    parsedEvents.forEach((event) => {
      if (!event.partId || parts.has(event.partId)) return

      parts.set(
        event.partId,
        event.partName || event.instrumentName || event.partId
      )
    })

    return Array.from(parts, ([id, name]) => ({ id, name }))
  }, [parsedEvents])

  const measureStartTicks = useMemo(() => {
    const startsByMeasure = new Map<number, number>()

    parsedEvents.forEach((event) => {
      const currentStart = startsByMeasure.get(event.measureNumber)
      if (currentStart === undefined || event.time < currentStart) {
        startsByMeasure.set(event.measureNumber, event.time)
      }
    })

    return new Set(startsByMeasure.values())
  }, [parsedEvents])

  useEffect(() => {
    activePartIdsRef.current = new Set(partDescriptors.map((part) => part.id))
  }, [partDescriptors])

  useEffect(() => {
    measureStartTicksRef.current = measureStartTicks
  }, [measureStartTicks])

  const getEventVelocity = useCallback((event: NoteEvent) => {
    const state = mixerStateRef.current
    const partState = state.parts[event.partId] ?? getDefaultPartState()
    const hasSolo =
      state.soloPartId !== null &&
      activePartIdsRef.current.has(state.soloPartId)

    if (state.metronomeSoloed || partState.isMuted) return 0
    if (hasSolo && state.soloPartId !== event.partId) return 0

    return clampVolume(
      state.masterVolume *
        partState.volume *
        getSamplerVolumeMultiplier(event.samplerId)
    )
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

    metronomeSynthRef.current = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.04,
        sustain: 0,
        release: 0.04,
      },
    }).toDestination()
    metronomeLoopRef.current = new Tone.Loop((time) => {
      const state = mixerStateRef.current
      if (state.metronomeMuted) return

      const tick = Math.round(Tone.getTransport().getTicksAtTime(time))
      const isMeasureStart =
        measureStartTicksRef.current.size > 0
          ? measureStartTicksRef.current.has(tick)
          : tick % DEFAULT_MEASURE_TICKS === 0

      metronomeSynthRef.current?.triggerAttackRelease(
        isMeasureStart ? METRONOME_ACCENT_NOTE : METRONOME_BEAT_NOTE,
        '32n',
        time,
        clampVolume(
          state.masterVolume *
            state.metronomeVolume *
            (isMeasureStart ? 1 : METRONOME_BEAT_VOLUME_MULTIPLIER)
        )
      )
    }, '4n')

    instrumentConfigs.forEach((config) => {
      samplers.current[config.id] = new Tone.Sampler({
        urls: config.urls,
        baseUrl: config.baseUrl,
      }).toDestination()
    })

    const currentSamplers = samplers.current

    return () => {
      metronomeLoopRef.current?.dispose()
      metronomeSynthRef.current?.dispose()
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
      const velocity = getEventVelocity(event)

      if (sampler.loaded && velocity > 0) {
        sampler.triggerAttackRelease(
          event.playbackKey,
          ticksToSeconds(event.duration),
          time,
          velocity
        )
      }
    }, partEvents)

    partRef.current.start(0)

    return () => {
      partRef.current?.dispose()
    }
  }, [getEventVelocity, parsedEvents, ticksToSeconds])

  // isPlaying に応じて Transport の開始/停止を同期
  useEffect(() => {
    if (isPlaying) {
      const startTicks = Math.max(
        0,
        useScoreStore.getState().highlightedNoteTime ?? 0
      )
      const startSeconds = ticksToSeconds(startTicks)

      onPlaybackStartRef.current?.(startTicks)
      metronomeLoopRef.current?.start(0)
      Tone.getTransport().start(undefined, startSeconds)
    } else {
      Tone.getDraw().cancel()
      Tone.getTransport().stop()
      metronomeLoopRef.current?.stop()
      Object.values(samplers.current).forEach((s) => s.releaseAll())
      metronomeSynthRef.current?.triggerRelease()
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

      sampler.triggerAttackRelease(
        playbackKey,
        durationSeconds,
        Tone.now(),
        clampVolume(
          mixerStateRef.current.masterVolume *
            getSamplerVolumeMultiplier(samplerId)
        )
      )
    },
    []
  )

  const soloPart = useCallback((partId: string) => {
    setMixerState((state) => {
      if (!activePartIdsRef.current.has(partId)) return state

      return {
        ...state,
        soloPartId: partId,
        metronomeSoloed: false,
        parts: {
          ...state.parts,
          [partId]: {
            ...(state.parts[partId] ?? getDefaultPartState()),
            isMuted: false,
          },
        },
      }
    })
  }, [])

  const clearSoloPart = useCallback(() => {
    setMixerState((state) =>
      state.soloPartId === null ? state : { ...state, soloPartId: null }
    )
  }, [])

  const mutePart = useCallback((partId: string) => {
    setMixerState((state) => {
      const partState = state.parts[partId]
      if (partState?.isMuted) return state

      return {
        ...state,
        parts: {
          ...state.parts,
          [partId]: { ...(partState ?? getDefaultPartState()), isMuted: true },
        },
      }
    })
  }, [])

  const unmutePart = useCallback((partId: string) => {
    setMixerState((state) => {
      const partState = state.parts[partId]
      if (!partState?.isMuted) return state

      return {
        ...state,
        parts: {
          ...state.parts,
          [partId]: { ...partState, isMuted: false },
        },
      }
    })
  }, [])

  const setPartVolume = useCallback((partId: string, volume: number) => {
    const nextVolume = clampVolume(volume)

    setMixerState((state) => {
      const partState = state.parts[partId]
      if (partState?.volume === nextVolume) return state

      return {
        ...state,
        parts: {
          ...state.parts,
          [partId]: {
            ...(partState ?? getDefaultPartState()),
            volume: nextVolume,
          },
        },
      }
    })
  }, [])

  const muteAll = useCallback(() => {
    setMixerState((state) => ({
      ...state,
      parts: {
        ...state.parts,
        ...Object.fromEntries(
          partDescriptors.map((part) => [
            part.id,
            {
              ...(state.parts[part.id] ?? getDefaultPartState()),
              isMuted: true,
            },
          ])
        ),
      },
    }))
  }, [partDescriptors])

  const unmuteAll = useCallback(() => {
    setMixerState((state) => ({
      ...state,
      soloPartId: null,
      parts: {
        ...state.parts,
        ...Object.fromEntries(
          partDescriptors.map((part) => [
            part.id,
            {
              ...(state.parts[part.id] ?? getDefaultPartState()),
              isMuted: false,
            },
          ])
        ),
      },
    }))
  }, [partDescriptors])

  const setMasterVolume = useCallback(
    (volume: number) => {
      const nextVolume = clampVolume(volume)
      setStoreVolume(nextVolume)
      setMixerState((state) =>
        state.masterVolume === nextVolume
          ? state
          : { ...state, masterVolume: nextVolume }
      )
    },
    [setStoreVolume]
  )

  const setMetronomeVolume = useCallback((volume: number) => {
    const nextVolume = clampVolume(volume)
    setMixerState((state) =>
      state.metronomeVolume === nextVolume
        ? state
        : { ...state, metronomeVolume: nextVolume }
    )
  }, [])

  const muteMetronome = useCallback(() => {
    setMixerState((state) =>
      state.metronomeMuted ? state : { ...state, metronomeMuted: true }
    )
  }, [])

  const unmuteMetronome = useCallback(() => {
    setMixerState((state) =>
      state.metronomeMuted ? { ...state, metronomeMuted: false } : state
    )
  }, [])

  const soloMetronome = useCallback(() => {
    setMixerState((state) =>
      state.metronomeSoloed && state.soloPartId === null
        ? state
        : { ...state, metronomeSoloed: true, soloPartId: null }
    )
  }, [])

  const clearMetronomeSolo = useCallback(() => {
    setMixerState((state) =>
      state.metronomeSoloed ? { ...state, metronomeSoloed: false } : state
    )
  }, [])

  const mixerControls = useMemo<AudioMixerControls>(
    () => ({
      parts: partDescriptors.map((part) => {
        const partState = mixerState.parts[part.id] ?? getDefaultPartState()

        return {
          ...part,
          volume: partState.volume,
          isMuted: partState.isMuted,
          isSoloed: mixerState.soloPartId === part.id,
        }
      }),
      masterVolume: mixerState.masterVolume,
      metronomeVolume: mixerState.metronomeVolume,
      isMetronomeMuted: mixerState.metronomeMuted,
      isMetronomeSoloed: mixerState.metronomeSoloed,
      soloPart,
      clearSoloPart,
      mutePart,
      unmutePart,
      setPartVolume,
      muteAll,
      unmuteAll,
      setMasterVolume,
      setMetronomeVolume,
      muteMetronome,
      unmuteMetronome,
      soloMetronome,
      clearMetronomeSolo,
    }),
    [
      clearMetronomeSolo,
      clearSoloPart,
      mixerState,
      muteMetronome,
      muteAll,
      mutePart,
      partDescriptors,
      setMasterVolume,
      setMetronomeVolume,
      setPartVolume,
      soloMetronome,
      soloPart,
      unmuteAll,
      unmuteMetronome,
      unmutePart,
    ]
  )

  return { play, stop, playNote, mixerControls }
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
