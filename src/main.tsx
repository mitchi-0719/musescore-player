import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import { App } from './App'
import './globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch((error: unknown) => {
        console.error('Service Worker registration failed:', error)
      })
  })
}
