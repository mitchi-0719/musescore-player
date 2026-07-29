import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as Tone from 'tone'

import { DRUM_MAP } from '../constants/drum'
import { PIANO_MAP } from '../constants/piano'
import type { NoteEvent, SamplerId } from '../lib/musicXmlParser'
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

type SamplerConfig = {
  urls: Record<string, string>
  baseUrl: string
}

const SAMPLER_CONFIGS: Record<SamplerId, SamplerConfig> = {
  piano: { urls: PIANO_MAP, baseUrl: '/sounds/piano/' },
  drum: { urls: DRUM_MAP, baseUrl: '/sounds/drums/' },
  clap: { urls: { C4: 'Clap.wav' }, baseUrl: '/sounds/clap/' },
}
const PIANO_SAMPLE_KEY_BY_MIDI = new Map<number, string>(
  Object.keys(PIANO_MAP).map((key) => [Tone.Frequency(key).toMidi(), key])
)
const DEFAULT_VOLUME = 1
const MAX_VOLUME = 2
const TICKS_PER_QUARTER = 192
const DEFAULT_MEASURE_TICKS = TICKS_PER_QUARTER * 4
const METRONOME_ACCENT_NOTE = 'C6'
const METRONOME_BEAT_NOTE = 'C5'
const METRONOME_BEAT_VOLUME_MULTIPLIER = 0.7
const MAX_PART_BOOST_DB = 12
const MAX_MASTER_BOOST_DB = 6
const MASTER_LIMITER_THRESHOLD_DB = -1
const VOLUME_RAMP_SECONDS = 0.03
// ミキサーの表示値は維持したまま、ドラム音源の出力だけを少し抑える。
const DRUM_VOLUME_MULTIPLIER = 0.8
const clampVolume = (volume: number) =>
  Math.min(MAX_VOLUME, Math.max(0, volume))
const mixerValueToDecibels = (volume: number, maxBoostDb: number) => {
  const clampedVolume = clampVolume(volume)

  if (clampedVolume === 0) return -Infinity
  if (clampedVolume <= DEFAULT_VOLUME) {
    return Tone.gainToDb(clampedVolume)
  }

  return (clampedVolume - DEFAULT_VOLUME) * maxBoostDb
}
const getSamplerVolumeMultiplier = (samplerId: string) =>
  samplerId === 'drum' ? DRUM_VOLUME_MULTIPLIER : 1
const getDefaultPartState = (): PartMixerState => ({
  volume: DEFAULT_VOLUME,
  isMuted: false,
})
const getClosestPianoSampleKey = (midi: number) => {
  for (let interval = 0; interval < 96; interval += 1) {
    const upperKey = PIANO_SAMPLE_KEY_BY_MIDI.get(midi + interval)
    if (upperKey) return upperKey

    const lowerKey = PIANO_SAMPLE_KEY_BY_MIDI.get(midi - interval)
    if (lowerKey) return lowerKey
  }

  return 'C4'
}
const getRequiredSamplerConfigs = (
  parsedEvents: NoteEvent[]
): Partial<Record<SamplerId, SamplerConfig>> => {
  const requiredKeys: Record<SamplerId, Set<string>> = {
    piano: new Set(),
    drum: new Set(),
    clap: new Set(),
  }

  parsedEvents.forEach((event) => {
    if (event.isRest) return

    if (event.samplerId === 'piano') {
      requiredKeys.piano.add(
        getClosestPianoSampleKey(Tone.Frequency(event.playbackKey).toMidi())
      )
      return
    }

    requiredKeys[event.samplerId].add(event.playbackKey)
  })

  return Object.fromEntries(
    (Object.keys(requiredKeys) as SamplerId[]).flatMap((samplerId) => {
      const keys = requiredKeys[samplerId]
      if (keys.size === 0) return []

      const config = SAMPLER_CONFIGS[samplerId]
      const urls = Object.fromEntries(
        Array.from(keys, (key) => [key, config.urls[key]]).filter(
          (entry): entry is [string, string] => Boolean(entry[1])
        )
      )

      return Object.keys(urls).length > 0
        ? [[samplerId, { urls, baseUrl: config.baseUrl }]]
        : []
    })
  )
}
const createSamplerFromSharedBuffers = (
  buffers: Tone.ToneAudioBuffers,
  sampleKeys: string[]
) =>
  new Tone.Sampler({
    urls: Object.fromEntries(sampleKeys.map((key) => [key, buffers.get(key)])),
  })

export const useAudioPlayer = (
  parsedEvents: NoteEvent[],
  options: AudioPlayerOptions = {}
) => {
  const samplers = useRef<Record<string, Tone.Sampler>>({})
  const sharedSampleBuffersRef = useRef<
    Partial<Record<SamplerId, Tone.ToneAudioBuffers>>
  >({})
  const partSamplersRef = useRef<Record<string, Tone.Sampler>>({})
  const partChannelsRef = useRef<Record<string, Tone.Channel>>({})
  const masterChannelRef = useRef<Tone.Channel | null>(null)
  const masterLimiterRef = useRef<Tone.Limiter | null>(null)
  const metronomeSynthRef = useRef<Tone.Synth | null>(null)
  const metronomeChannelRef = useRef<Tone.Channel | null>(null)
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
  const [loadedSampleSignature, setLoadedSampleSignature] = useState<
    string | null
  >(null)
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

  const partSamplerDescriptors = useMemo(() => {
    const descriptors = new Map<
      string,
      { partId: string; samplerId: NoteEvent['samplerId'] }
    >()

    parsedEvents.forEach((event) => {
      if (!event.partId) return

      const key = `${event.partId}:${event.samplerId}`
      if (!descriptors.has(key)) {
        descriptors.set(key, {
          partId: event.partId,
          samplerId: event.samplerId,
        })
      }
    })

    return Array.from(descriptors.entries(), ([key, descriptor]) => ({
      key,
      ...descriptor,
    }))
  }, [parsedEvents])

  const requiredSamplerConfigs = useMemo(
    () => getRequiredSamplerConfigs(parsedEvents),
    [parsedEvents]
  )
  const requiredSampleSignature = useMemo(
    () =>
      (Object.entries(requiredSamplerConfigs) as [SamplerId, SamplerConfig][])
        .map(
          ([samplerId, config]) =>
            `${samplerId}:${Object.keys(config.urls).sort().join(',')}`
        )
        .sort()
        .join('|'),
    [requiredSamplerConfigs]
  )

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

  useEffect(() => {
    masterLimiterRef.current = new Tone.Limiter(
      MASTER_LIMITER_THRESHOLD_DB
    ).toDestination()
    masterChannelRef.current = new Tone.Channel({
      volume: mixerValueToDecibels(
        mixerStateRef.current.masterVolume,
        MAX_MASTER_BOOST_DB
      ),
    }).connect(masterLimiterRef.current)
    metronomeChannelRef.current = new Tone.Channel().connect(
      masterChannelRef.current
    )

    metronomeSynthRef.current = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.04,
        sustain: 0,
        release: 0.04,
      },
    }).connect(metronomeChannelRef.current)
    metronomeLoopRef.current = new Tone.Loop((time) => {
      const tick = Math.round(Tone.getTransport().getTicksAtTime(time))
      const isMeasureStart =
        measureStartTicksRef.current.size > 0
          ? measureStartTicksRef.current.has(tick)
          : tick % DEFAULT_MEASURE_TICKS === 0

      metronomeSynthRef.current?.triggerAttackRelease(
        isMeasureStart ? METRONOME_ACCENT_NOTE : METRONOME_BEAT_NOTE,
        '32n',
        time,
        isMeasureStart ? 1 : METRONOME_BEAT_VOLUME_MULTIPLIER
      )
    }, '4n')

    return () => {
      metronomeLoopRef.current?.dispose()
      metronomeSynthRef.current?.dispose()
      metronomeChannelRef.current?.dispose()
      masterChannelRef.current?.dispose()
      masterLimiterRef.current?.dispose()
      metronomeChannelRef.current = null
      masterChannelRef.current = null
      masterLimiterRef.current = null
    }
  }, [])

  useEffect(() => {
    let isDisposed = false
    const configEntries = Object.entries(requiredSamplerConfigs) as [
      SamplerId,
      SamplerConfig,
    ][]

    sharedSampleBuffersRef.current = {}

    if (configEntries.length === 0) return

    let loadedCount = 0
    const sharedBuffers: Partial<Record<SamplerId, Tone.ToneAudioBuffers>> = {}
    const handleBuffersLoaded = () => {
      loadedCount += 1
      if (!isDisposed && loadedCount === configEntries.length) {
        setLoadedSampleSignature(requiredSampleSignature)
      }
    }

    configEntries.forEach(([samplerId, config]) => {
      sharedBuffers[samplerId] = new Tone.ToneAudioBuffers({
        urls: config.urls,
        baseUrl: config.baseUrl,
        onload: handleBuffersLoaded,
      })
    })
    sharedSampleBuffersRef.current = sharedBuffers

    return () => {
      isDisposed = true
      Object.values(sharedBuffers).forEach((buffers) => buffers?.dispose())
      sharedSampleBuffersRef.current = {}
    }
  }, [requiredSampleSignature, requiredSamplerConfigs])

  useEffect(() => {
    const masterChannel = masterChannelRef.current
    if (!masterChannel || loadedSampleSignature !== requiredSampleSignature) {
      return
    }

    const currentSamplers: Record<string, Tone.Sampler> = {}
    const configEntries = Object.entries(requiredSamplerConfigs) as [
      SamplerId,
      SamplerConfig,
    ][]

    configEntries.forEach(([samplerId, config]) => {
      const buffers = sharedSampleBuffersRef.current[samplerId]
      if (!buffers) return

      currentSamplers[samplerId] = createSamplerFromSharedBuffers(
        buffers,
        Object.keys(config.urls)
      ).connect(masterChannel)
    })
    samplers.current = currentSamplers

    return () => {
      Object.values(currentSamplers).forEach((sampler) => sampler.dispose())
      samplers.current = {}
    }
  }, [loadedSampleSignature, requiredSampleSignature, requiredSamplerConfigs])

  useEffect(() => {
    const masterChannel = masterChannelRef.current
    if (!masterChannel || loadedSampleSignature !== requiredSampleSignature) {
      return
    }
    const channels: Record<string, Tone.Channel> = {}
    const partSamplers: Record<string, Tone.Sampler> = {}
    const currentMixerState = mixerStateRef.current
    const hasSolo =
      currentMixerState.soloPartId !== null &&
      activePartIdsRef.current.has(currentMixerState.soloPartId)

    partDescriptors.forEach((part) => {
      const partState =
        currentMixerState.parts[part.id] ?? getDefaultPartState()

      channels[part.id] = new Tone.Channel({
        volume: mixerValueToDecibels(partState.volume, MAX_PART_BOOST_DB),
        mute:
          currentMixerState.metronomeSoloed ||
          partState.isMuted ||
          (hasSolo && currentMixerState.soloPartId !== part.id),
      }).connect(masterChannel)
    })

    partSamplerDescriptors.forEach(({ key, partId, samplerId }) => {
      const channel = channels[partId]
      if (!channel) return

      const buffers = sharedSampleBuffersRef.current[samplerId]
      const config = requiredSamplerConfigs[samplerId]
      if (!buffers || !config) return

      partSamplers[key] = createSamplerFromSharedBuffers(
        buffers,
        Object.keys(config.urls)
      ).connect(channel)
    })

    partChannelsRef.current = channels
    partSamplersRef.current = partSamplers

    return () => {
      Object.values(partSamplers).forEach((sampler) => sampler.dispose())
      Object.values(channels).forEach((channel) => channel.dispose())
      partSamplersRef.current = {}
      partChannelsRef.current = {}
    }
  }, [
    loadedSampleSignature,
    partDescriptors,
    partSamplerDescriptors,
    requiredSampleSignature,
    requiredSamplerConfigs,
  ])

  useEffect(() => {
    const hasSolo =
      mixerState.soloPartId !== null &&
      activePartIdsRef.current.has(mixerState.soloPartId)

    Object.entries(partChannelsRef.current).forEach(([partId, channel]) => {
      const partState = mixerState.parts[partId] ?? getDefaultPartState()

      channel.volume.rampTo(
        mixerValueToDecibels(partState.volume, MAX_PART_BOOST_DB),
        VOLUME_RAMP_SECONDS
      )
      channel.mute =
        mixerState.metronomeSoloed ||
        partState.isMuted ||
        (hasSolo && mixerState.soloPartId !== partId)
    })

    masterChannelRef.current?.volume.rampTo(
      mixerValueToDecibels(mixerState.masterVolume, MAX_MASTER_BOOST_DB),
      VOLUME_RAMP_SECONDS
    )

    if (metronomeChannelRef.current) {
      metronomeChannelRef.current.volume.rampTo(
        mixerValueToDecibels(mixerState.metronomeVolume, MAX_PART_BOOST_DB),
        VOLUME_RAMP_SECONDS
      )
      metronomeChannelRef.current.mute = mixerState.metronomeMuted || hasSolo
    }
  }, [mixerState])

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

      const sampler =
        partSamplersRef.current[`${event.partId}:${event.samplerId}`]
      const velocity = getSamplerVolumeMultiplier(event.samplerId)

      if (sampler?.loaded) {
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
      metronomeLoopRef.current?.start(0)
      Tone.getTransport().start(undefined, startSeconds)
    } else {
      Tone.getDraw().cancel()
      Tone.getTransport().stop()
      metronomeLoopRef.current?.stop()
      Object.values(samplers.current).forEach((s) => s.releaseAll())
      Object.values(partSamplersRef.current).forEach((s) => s.releaseAll())
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
        getSamplerVolumeMultiplier(samplerId)
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
