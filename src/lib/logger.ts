type LogMethod = (...data: unknown[]) => void

const noop: LogMethod = () => undefined

/**
 * 開発環境だけブラウザコンソールへ出力する共通ロガー。
 * 本番ビルドではすべてのメソッドが何もしない。
 */
export const logger = {
  debug: import.meta.env.DEV ? console.debug.bind(console) : noop,
  log: import.meta.env.DEV ? console.log.bind(console) : noop,
  info: import.meta.env.DEV ? console.info.bind(console) : noop,
  warn: import.meta.env.DEV ? console.warn.bind(console) : noop,
  error: import.meta.env.DEV ? console.error.bind(console) : noop,
} satisfies Record<'debug' | 'log' | 'info' | 'warn' | 'error', LogMethod>
