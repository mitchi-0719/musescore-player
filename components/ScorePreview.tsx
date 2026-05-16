'use client'
import { useOSMD } from '@/hooks/useOSMD'
import { useScoreStore } from '@/stores/useScoreStore'

import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

export const ScorePreview = () => {
  const musicXml = useScoreStore((state) => state.musicXml)

  const { containerRef, renderError, isRendering } = useOSMD(musicXml)

  if (!musicXml) return null

  return (
    <section>
      {renderError ? (
        <Alert variant="error">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{renderError}</AlertDescription>
        </Alert>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border bg-white">
          <div ref={containerRef} className="min-h-24 w-full" />
          {isRendering ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm">
              楽譜を変換中...
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
