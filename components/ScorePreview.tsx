'use client'
import { useOSMD } from '@/hooks/useOSMD'
import { useScoreStore } from '@/stores/useScoreStore'

import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

export const ScorePreview = () => {
  const musicXml = useScoreStore((state) => state.musicXml)

  // 泥臭い処理はすべてカスタムフックにお任せ！
  const { containerRef, renderError } = useOSMD(musicXml)

  if (!musicXml) return null

  return (
    <section className="m-2 space-y-3">
      {renderError ? (
        <Alert variant="error">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{renderError}</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <div ref={containerRef} className="min-h-24 w-full" />
        </div>
      )}
    </section>
  )
}
