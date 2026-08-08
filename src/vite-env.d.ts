/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEATURE_DEMO_BUTTON?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
