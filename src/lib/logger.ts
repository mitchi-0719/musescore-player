import { appEnvironment } from '../config/featureFlags'

type LogMethod = (...data: unknown[]) => void

const noop: LogMethod = () => undefined

/**
 * 開発環境だけブラウザコンソールへ出力する共通ロガー。
 * 本番ビルドではすべてのメソッドが何もしない。
 */
export const logger = {
  debug: appEnvironment.isDevelopment ? console.debug.bind(console) : noop,
  log: appEnvironment.isDevelopment ? console.log.bind(console) : noop,
  info: appEnvironment.isDevelopment ? console.info.bind(console) : noop,
  warn: appEnvironment.isDevelopment ? console.warn.bind(console) : noop,
  error: appEnvironment.isDevelopment ? console.error.bind(console) : noop,
} satisfies Record<'debug' | 'log' | 'info' | 'warn' | 'error', LogMethod>
