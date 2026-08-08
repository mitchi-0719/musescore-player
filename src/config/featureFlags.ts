const isEnabled = (value: string | undefined): boolean => value === 'true'

/**
 * Release前の機能だけをここで管理する。
 * 環境変数が未設定の場合は常にfalseになり、公開後はフラグごと削除する。
 */
export const featureFlags = {
  demoButton: isEnabled(import.meta.env.VITE_FEATURE_DEMO_BUTTON),
} as const
