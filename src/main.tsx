import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
import { appEnvironment } from './config/featureFlags'
import './globals.css'
import { configurePlaybackAudioSession } from './lib/audioSession'
import { logger } from './lib/logger'

configurePlaybackAudioSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

if (appEnvironment.isProduction && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch((error: unknown) => {
        logger.error('Service Worker registration failed:', error)
      })
  })
}
