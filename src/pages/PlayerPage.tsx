import { useEffect, useState } from 'react'

import { FileUploader } from '../components/FileUploader'
import { PwaInstallDialog } from '../components/PwaInstallDialog'
import { ScorePreview } from '../components/ScorePreview'
import { Footer } from '../components/layout/Footer'
import { Header } from '../components/layout/Header'
import { useScoreStore } from '../stores/useScoreStore'

const PWA_GUIDE_STORAGE_KEY = 'refinear:pwa-install-guide-shown:v1'

const isRunningAsInstalledApp = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator && navigator.standalone === true)

const shouldShowInitialPwaGuide = () => {
  if (isRunningAsInstalledApp()) return false
  try {
    return localStorage.getItem(PWA_GUIDE_STORAGE_KEY) === null
  } catch {
    return true
  }
}

export const PlayerPage = () => {
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(
    shouldShowInitialPwaGuide
  )
  const fileName = useScoreStore((state) => state.fileName)
  const musicXml = useScoreStore((state) => state.musicXml)
  const isLoading = useScoreStore((state) => state.isLoading)
  const hasScore = Boolean(fileName && musicXml && !isLoading)

  useEffect(() => {
    if (!isInstallGuideOpen) return
    try {
      localStorage.setItem(PWA_GUIDE_STORAGE_KEY, 'true')
    } catch {
      // Storageを利用できない環境でも案内自体は表示する。
    }
  }, [isInstallGuideOpen])

  return (
    <div className="flex min-h-screen flex-col bg-[#f8faff] text-[#071b47]">
      <Header
        hasScore={hasScore}
        onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
      />
      <main
        className={hasScore ? 'flex-1 bg-white' : 'mx-auto w-full max-w-5xl'}
      >
        {hasScore ? <ScorePreview /> : <FileUploader />}
      </main>
      {!hasScore && <Footer />}
      <PwaInstallDialog
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
      />
    </div>
  )
}
