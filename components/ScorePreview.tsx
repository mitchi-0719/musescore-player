'use client'
import { useEffect } from 'react'

import { useOSMD } from '@/hooks/useOSMD'
import { useScoreStore } from '@/stores/useScoreStore'

import AudioPlayer from './AudioPlayer'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

export const ScorePreview = () => {
  const musicXml = useScoreStore((state) => state.musicXml)

  const { containerRef, renderError, isRendering, osmdRef } = useOSMD(musicXml)
  const currentTime = useScoreStore((s) => s.currentTime)

  useEffect(() => {
    // Best-effort: attempt to highlight measure based on currentTime.
    // OSMD APIs vary; we attempt a safe DOM-based highlight as fallback.
    if (!containerRef.current) return
    try {
      // remove previous highlights
      const prev = containerRef.current.querySelectorAll(
        '.musescore-player-highlight'
      )
      prev.forEach((el) => el.classList.remove('musescore-player-highlight'))

      // simple heuristic: highlight first element that looks like a measure
      const measures = containerRef.current.querySelectorAll(
        '[data-measure-number], .Measure, svg g.measure'
      )
      if (measures && measures.length > 0) {
        const idx = Math.floor(
          (currentTime % Math.max(1, currentTime + 1)) % measures.length
        )
        const el = measures[idx]
        if (el) el.classList.add('musescore-player-highlight')
      }
    } catch (e) {
      // ignore
    }
  }, [currentTime, containerRef])

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
          <div className="absolute top-3 right-3 rounded bg-white/80 px-2 py-1 text-xs">
            <AudioPlayer />
          </div>
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
