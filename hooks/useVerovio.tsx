'use client'

import { useEffect, useRef, useState } from 'react'

import { useScoreStore } from '@/stores/useScoreStore'

/**
 * Verovio の描画エラーを示すインターフェース
 */
export interface VerovioError {
  code: string
  message: string
}

/**
 * Verovio Toolkit が返す Timemap オブジェクト
 * { noteId: { tstamp: number, realTimeSeconds: number }, ... }
 */
export interface Timemap {
  [key: string]: {
    tstamp: number
    realTimeSeconds: number
  }
}

/**
 * Verovio MIDI データの型
 */
export interface MIDIData {
  buffer?: ArrayBuffer
  data?: Uint8Array
  base64?: string
}

/**
 * Verovio Toolkit インスタンス型
 */
interface VerovioToolkit {
  loadData(data: string | ArrayBuffer, options?: Record<string, unknown>): void
  renderToSVG(pageNum?: number, options?: Record<string, unknown>): string
  renderToMIDI(): ArrayBuffer | null
  renderToTimemap(): Timemap | null
  getVersion(): string
  getOptions(): Record<string, unknown>
  setOptions(options: Record<string, unknown>): void
}

/**
 * Verovio WASM モジュールのコンストラクタ型
 */
type VerovioModule = (
  options?: Record<string, unknown>
) => Promise<VerovioToolkit>

/**
 * Verovio Hook の内部状態
 */
interface UseVerovioState {
  toolkit: VerovioToolkit | null
  loaded: boolean
  error: VerovioError | null
  isInitializing: boolean
}

/**
 * Verovio Toolkit を初期化・管理し、WASM ロード失敗に対応するフック
 *
 * @returns {Object} ツールキットへのアクセス、ロード状態、エラー情報
 */
export const useVerovio = () => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<UseVerovioState>({
    toolkit: null,
    loaded: false,
    error: null,
    isInitializing: true,
  })

  /**
   * Verovio Toolkit を初期化する
   * WASM ファイルロード失敗時はエラーオブジェクトを返す
   */
  const initVerovio = async (): Promise<VerovioToolkit | VerovioError> => {
    try {
      // ESM 形式で動的インポート
      // @ts-ignore - Verovio モジュールは WASM をデフォルトエクスポート
      const Verovio = (await import('verovio')) as unknown as VerovioModule

      if (!Verovio || typeof Verovio !== 'function') {
        throw new Error('Verovio module not properly loaded')
      }

      // WASM ファイルロード設定を行い、Toolkit を初期化
      const toolkit = await Verovio({
        wasmBinary: undefined, // CDN から自動ロード
        locateFile: (filename: string) => {
          // WASM ファイルパス設定（CDN）
          return `https://cdn.jsdelivr.net/npm/verovio@6.1.0/wasm/${filename}`
        },
      })

      if (!toolkit) {
        throw new Error('Failed to instantiate Verovio Toolkit')
      }

      setState((prev) => ({
        ...prev,
        toolkit,
        loaded: true,
        error: null,
        isInitializing: false,
      }))

      return toolkit
    } catch (err) {
      const error: VerovioError = {
        code: 'VEROVIO_INIT_FAILED',
        message: `Verovio Toolkit の初期化に失敗しました: ${
          err instanceof Error ? err.message : String(err)
        }`,
      }
      setState((prev) => ({
        ...prev,
        toolkit: null,
        loaded: false,
        error,
        isInitializing: false,
      }))
      return error
    }
  }

  /**
   * MSCZ / MXL ファイルをツールキットにロード
   *
   * @param data - ファイルバイナリ（Uint8Array）またはMusicXML文字列
   * @returns {Object} { success: boolean, error?: VerovioError }
   */
  const loadScore = (
    data: Uint8Array | string
  ): { success: boolean; error?: VerovioError } => {
    if (!state.toolkit) {
      return {
        success: false,
        error: {
          code: 'TOOLKIT_NOT_INITIALIZED',
          message: 'Verovio Toolkit が初期化されていません',
        },
      }
    }

    try {
      // 文字列の場合はそのまま、Uint8Array の場合は ArrayBuffer に変換
      const input =
        typeof data === 'string' ? data : new Uint8Array(data).buffer

      state.toolkit.loadData(input, {
        pageHeight: 2970,
        pageWidth: 2100,
        scale: 100,
        adjustPageHeight: true,
      })

      return { success: true }
    } catch (err) {
      const error: VerovioError = {
        code: 'LOAD_SCORE_FAILED',
        message: `スコアのロードに失敗しました: ${
          err instanceof Error ? err.message : String(err)
        }`,
      }
      return { success: false, error }
    }
  }

  /**
   * SVG にレンダリング
   *
   * @param pageNum - ページ番号（デフォルト: 1）
   * @param options - レンダリングオプション
   * @returns {Object} { svg: string | null, error?: VerovioError }
   */
  const renderToSVG = (
    pageNum: number = 1,
    options?: Record<string, unknown>
  ): { svg: string | null; error?: VerovioError } => {
    if (!state.toolkit) {
      return {
        svg: null,
        error: {
          code: 'TOOLKIT_NOT_INITIALIZED',
          message: 'Verovio Toolkit が初期化されていません',
        },
      }
    }

    try {
      const svg = state.toolkit.renderToSVG(pageNum, options)
      return { svg }
    } catch (err) {
      const error: VerovioError = {
        code: 'RENDER_SVG_FAILED',
        message: `SVG レンダリングに失敗しました: ${
          err instanceof Error ? err.message : String(err)
        }`,
      }
      return { svg: null, error }
    }
  }

  /**
   * MIDI データにレンダリング
   *
   * @returns {Object} { midi: MIDIData | null, error?: VerovioError }
   */
  const renderToMIDI = (): { midi: MIDIData | null; error?: VerovioError } => {
    if (!state.toolkit) {
      return {
        midi: null,
        error: {
          code: 'TOOLKIT_NOT_INITIALIZED',
          message: 'Verovio Toolkit が初期化されていません',
        },
      }
    }

    try {
      const midiBuffer = state.toolkit.renderToMIDI()
      if (!midiBuffer) {
        throw new Error('MIDI rendering returned null')
      }

      const midiData: MIDIData = {
        buffer: midiBuffer,
        data: new Uint8Array(midiBuffer),
      }

      return { midi: midiData }
    } catch (err) {
      const error: VerovioError = {
        code: 'RENDER_MIDI_FAILED',
        message: `MIDI レンダリングに失敗しました: ${
          err instanceof Error ? err.message : String(err)
        }`,
      }
      return { midi: null, error }
    }
  }

  /**
   * Timemap を取得し、Zustand ストアに自動保存
   *
   * @returns {Object} { timemap: Timemap | null, error?: VerovioError }
   */
  const renderToTimemap = (): {
    timemap: Timemap | null
    error?: VerovioError
  } => {
    if (!state.toolkit) {
      return {
        timemap: null,
        error: {
          code: 'TOOLKIT_NOT_INITIALIZED',
          message: 'Verovio Toolkit が初期化されていません',
        },
      }
    }

    try {
      const timemap = state.toolkit.renderToTimemap()
      if (!timemap) {
        throw new Error('Timemap rendering returned null')
      }

      // Zustand ストアに自動保存
      useScoreStore.getState().setTimemap(timemap)

      return { timemap }
    } catch (err) {
      const error: VerovioError = {
        code: 'RENDER_TIMEMAP_FAILED',
        message: `Timemap レンダリングに失敗しました: ${
          err instanceof Error ? err.message : String(err)
        }`,
      }
      return { timemap: null, error }
    }
  }

  // コンポーネントマウント時に Verovio を初期化
  useEffect(() => {
    let isCancelled = false

    const setup = async () => {
      const result = await initVerovio()
      if (!isCancelled) {
        if ('code' in result) {
          // Error case
          setState((prev) => ({
            ...prev,
            error: result,
            isInitializing: false,
          }))
        }
      }
    }

    setup()

    return () => {
      isCancelled = true
    }
  }, [])

  return {
    containerRef,
    state,
    initVerovio,
    loadScore,
    renderToSVG,
    renderToMIDI,
    renderToTimemap,
  }
}
