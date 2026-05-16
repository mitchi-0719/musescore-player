'use client'

import { useEffect, useRef, useState } from 'react'

import { useScoreStore } from '@/stores/useScoreStore'

import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

type OSMDInstance = import('opensheetmusicdisplay').OpenSheetMusicDisplay

export default function ScorePreview() {
  const musicXml = useScoreStore((state) => state.musicXml)
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OSMDInstance | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    if (!musicXml || !containerRef.current) {
      return
    }

    let isCancelled = false

    const renderScore = async () => {
      try {
        setRenderError(null)
        osmdRef.current?.clear()
        if (containerRef.current) {
          containerRef.current.innerHTML = ''
        }

        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        if (isCancelled || !containerRef.current) return

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
        })
        osmdRef.current = osmd

        await osmd.load(musicXml)
        if (isCancelled) return

        osmd.render()
        if (isCancelled) {
          osmd.clear()
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : '楽譜の描画中に不明なエラーが発生しました'
        setRenderError(
          `楽譜の描画に失敗しました。別のファイルをお試しください。（詳細: ${message}）`
        )
      }
    }

    renderScore()

    return () => {
      isCancelled = true
      osmdRef.current?.clear()
      osmdRef.current = null
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [musicXml])

  if (!musicXml) {
    return null
  }

  return (
    <section aria-labelledby="score-preview-heading" className="space-y-3">
      <h2
        id="score-preview-heading"
        className="text-xl font-semibold text-gray-900"
      >
        楽譜プレビュー
      </h2>

      {renderError ? (
        <Alert variant="error">
          <AlertTitle>描画エラー</AlertTitle>
          <AlertDescription>{renderError}</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-2">
          <div
            ref={containerRef}
            className="min-h-24"
            role="img"
            aria-label="楽譜プレビュー"
          />
        </div>
      )}
    </section>
  )
}
