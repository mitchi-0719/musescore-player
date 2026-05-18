import { create } from 'zustand'

import type { Timemap } from '@/hooks/useVerovio'

export type PlayerHandle = {
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  setTempo: (bpm: number) => void
  getCurrentTime: () => number
  onTimeUpdate: (cb: (t: number) => void) => () => void
  playNote?: (note: string | number, duration?: number) => void
  dispose: () => void
}

export interface MeasureMetadata {
  number: number
  startTime: number
  endTime: number
  duration: number
}

export interface NoteMetadata {
  time: number
  duration: number
  midi: number
  measureNumber: number
}

export interface ScoreState {
  // ファイル情報
  fileName: string | null
  fileBinary: Uint8Array | null

  // 解析状態
  isLoading: boolean
  error: string | null

  // 結果
  musicXml: string | null
  musicMxl: Uint8Array | null

  // メタデータ
  measures: MeasureMetadata[]
  notes: NoteMetadata[]
  totalDuration: number

  // 再生関連
  player: PlayerHandle | null
  isPlaying: boolean
  currentTime: number
  tempo: number
  volume: number

  // ハイライト状態
  highlightedMeasureNumber: number | null
  highlightedNoteTime: number | null

  // Verovio Timemap
  timemap: Timemap | null

  // 解析 / 再生 アクション
  setFileBinary: (binary: Uint8Array, fileName: string) => void
  setMusicXml: (xml: string) => void
  setMusicMxl: (mxl: Uint8Array | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  setMeasures: (measures: MeasureMetadata[]) => void
  setNotes: (notes: NoteMetadata[]) => void
  setTotalDuration: (duration: number) => void
  setTimemap: (timemap: Timemap) => void
  getTimemap: () => Timemap | null
  reset: () => void

  // 再生状態管理アクション
  setPlayer: (p: PlayerHandle | null) => void
  setIsPlaying: (v: boolean) => void
  setCurrentTime: (t: number) => void
  setTempo: (bpm: number) => void
  setVolume: (v: number) => void
  setHighlightedMeasure: (measureNumber: number | null) => void
  setHighlightedNote: (time: number | null) => void
}

export const useScoreStore = create<ScoreState>((set, get) => ({
  fileName: null,
  fileBinary: null,
  isLoading: false,
  error: null,
  musicXml: null,
  musicMxl: null,

  // metadata
  measures: [],
  notes: [],
  totalDuration: 0,

  // player state
  player: null,
  isPlaying: false,
  currentTime: 0,
  tempo: 120,
  volume: 1,

  // highlight state
  highlightedMeasureNumber: null,
  highlightedNoteTime: null,

  // Verovio Timemap
  timemap: null,

  setFileBinary: (binary, fileName) =>
    set({ fileBinary: binary, fileName, error: null }),

  setMusicXml: (xml) => set({ musicXml: xml }),

  setMusicMxl: (mxl) => set({ musicMxl: mxl }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setMeasures: (measures) => set({ measures }),

  setNotes: (notes) => set({ notes }),

  setTotalDuration: (duration) => set({ totalDuration: duration }),

  setTimemap: (timemap) => set({ timemap }),

  getTimemap: () => get().timemap,

  reset: () =>
    set({
      fileName: null,
      fileBinary: null,
      isLoading: false,
      error: null,
      musicXml: null,
      musicMxl: null,
      measures: [],
      notes: [],
      totalDuration: 0,
      player: null,
      isPlaying: false,
      currentTime: 0,
      tempo: 120,
      volume: 1,
      highlightedMeasureNumber: null,
      highlightedNoteTime: null,
      timemap: null,
    }),

  // playback actions
  setPlayer: (p) =>
    set((state) => (state.player === p ? state : { player: p })),
  setIsPlaying: (v) =>
    set((state) => (state.isPlaying === v ? state : { isPlaying: v })),
  setCurrentTime: (t) =>
    set((state) =>
      Math.abs(state.currentTime - t) < 0.01 ? state : { currentTime: t }
    ),
  setTempo: (bpm) =>
    set((state) => (state.tempo === bpm ? state : { tempo: bpm })),
  setVolume: (v) =>
    set((state) => (state.volume === v ? state : { volume: v })),
  setHighlightedMeasure: (measureNumber) =>
    set((state) =>
      state.highlightedMeasureNumber === measureNumber
        ? state
        : { highlightedMeasureNumber: measureNumber }
    ),
  setHighlightedNote: (time) =>
    set((state) =>
      state.highlightedNoteTime === time ? state : { highlightedNoteTime: time }
    ),
}))
