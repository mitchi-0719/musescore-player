/**
 * Verovio WASM モジュールの型定義
 * Verovio は WASM ベースの楽譜レンダリングライブラリ
 */

export interface VerovioOptions {
  locateFile?: (filename: string) => string
  wasmBinary?: Uint8Array
  [key: string]: unknown
}

export interface VerovioToolkit {
  loadData(data: string | ArrayBuffer, options?: Record<string, unknown>): void
  renderToSVG(pageNum?: number, options?: Record<string, unknown>): string
  renderToMIDI(): ArrayBuffer | null
  renderToTimemap(): Record<
    string,
    {
      tstamp: number
      realTimeSeconds: number
    }
  > | null
  getVersion(): string
  getOptions(): Record<string, unknown>
  setOptions(options: Record<string, unknown>): void
}

declare module 'verovio' {
  function Verovio(options?: VerovioOptions): Promise<VerovioToolkit>
  export default Verovio
}
