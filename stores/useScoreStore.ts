import { create } from 'zustand'

export interface ScoreState {
  // ファイル情報
  fileName: string | null
  fileBinary: Uint8Array | null

  // 解析状態
  isLoading: boolean
  error: string | null

  // 結果
  musicXml: string | null

  // アクション
  setFileBinary: (binary: Uint8Array, fileName: string) => void
  setMusicXml: (xml: string) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useScoreStore = create<ScoreState>((set) => ({
  fileName: null,
  fileBinary: null,
  isLoading: false,
  error: null,
  musicXml: null,

  setFileBinary: (binary, fileName) =>
    set({ fileBinary: binary, fileName, error: null }),

  setMusicXml: (xml) => set({ musicXml: xml, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () =>
    set({
      fileName: null,
      fileBinary: null,
      isLoading: false,
      error: null,
      musicXml: null,
    }),
}))
