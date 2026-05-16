import { create } from 'zustand'

export type PlayerHandle = {
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  setTempo: (bpm: number) => void
  getCurrentTime: () => number
  onTimeUpdate: (cb: (t: number) => void) => () => void
  dispose: () => void
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

  // 再生関連
  player: PlayerHandle | null
  isPlaying: boolean
  currentTime: number
  tempo: number
  volume: number

  // 解析 / 再生 アクション
  setFileBinary: (binary: Uint8Array, fileName: string) => void
  setMusicXml: (xml: string) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void

  // 再生状態管理アクション
  setPlayer: (p: PlayerHandle | null) => void
  setIsPlaying: (v: boolean) => void
  setCurrentTime: (t: number) => void
  setTempo: (bpm: number) => void
  setVolume: (v: number) => void
}

export const useScoreStore = create<ScoreState>((set) => ({
  fileName: null,
  fileBinary: null,
  isLoading: false,
  error: null,
  musicXml: null,

  // player state
  player: null,
  isPlaying: false,
  currentTime: 0,
  tempo: 120,
  volume: 1,

  setFileBinary: (binary, fileName) =>
    set({ fileBinary: binary, fileName, error: null }),

  setMusicXml: (xml) => set({ musicXml: xml }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      fileName: null,
      fileBinary: null,
      isLoading: false,
      error: null,
      musicXml: null,
      player: null,
      isPlaying: false,
      currentTime: 0,
      tempo: 120,
      volume: 1,
    }),

  // playback actions
  setPlayer: (p) => set({ player: p }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setTempo: (bpm) => set({ tempo: bpm }),
  setVolume: (v) => set({ volume: v }),
}))
