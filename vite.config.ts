import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    nodePolyfills({
      exclude: ['vm'],
      globals: {
        Buffer: true,
      },
    }),
  ],
  build: {
    // OSMD is loaded only after a score is selected. Its minified package is
    // currently about 1.25 MB, so keep the warning narrowly above that known
    // lazy chunk instead of masking future multi-megabyte regressions.
    chunkSizeWarningLimit: 1300,
  },
})
