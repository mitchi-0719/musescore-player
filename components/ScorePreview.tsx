'use client'
import { useEffect } from 'react'

import { midiToNoteName, parseMusicXmlForEvents } from '@/hooks/useAudioPlayer'
import { useOSMD } from '@/hooks/useOSMD'
import { useScoreStore } from '@/stores/useScoreStore'

import { ControlModal } from './ControlModal'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

export const ScorePreview = () => {
  const musicXml = useScoreStore((state) => state.musicXml)

  const { containerRef, renderError, isRendering, osmdRef } = useOSMD(musicXml)
  const currentTime = useScoreStore((s) => s.currentTime)
  const highlightedMeasureNumber = useScoreStore(
    (s) => s.highlightedMeasureNumber
  )

  const isLoading = useScoreStore((s) => s.isLoading)
  const fileName = useScoreStore((s) => s.fileName)

  const isLoadingScore = Boolean((isLoading || isRendering) && !musicXml)

  // ハイライト表現を改善：小節メタデータを使用
  useEffect(() => {
    if (!containerRef.current) return

    try {
      // 前のハイライトを削除
      const prevHighlights = containerRef.current.querySelectorAll(
        '.musescore-player-highlight'
      )
      prevHighlights.forEach((el) =>
        el.classList.remove('musescore-player-highlight')
      )

      if (highlightedMeasureNumber !== null) {
        // 小節番号属性を使用してハイライト
        const measureSelector = `[data-measure-number="${highlightedMeasureNumber}"], 
                                [data-measure="${highlightedMeasureNumber}"],
                                .measure[id*="measure${highlightedMeasureNumber}"]`

        const measuresWithAttr =
          containerRef.current.querySelectorAll(measureSelector)

        if (measuresWithAttr.length > 0) {
          measuresWithAttr.forEach((el) => {
            el.classList.add('musescore-player-highlight')
          })
        } else {
          // フォールバック：小節要素を検索
          const measures = containerRef.current.querySelectorAll(
            '[class*="Measure"], svg g[class*="measure"]'
          )
          if (
            measures &&
            measures.length > 0 &&
            highlightedMeasureNumber <= measures.length
          ) {
            const idx = highlightedMeasureNumber - 1
            const el = measures[idx]
            if (el) el.classList.add('musescore-player-highlight')
          }
        }
      }
    } catch (e) {
      console.warn('Highlight error:', e)
    }
  }, [highlightedMeasureNumber])

  // ノートクリック時の発音機能
  useEffect(() => {
    try {
      const player = useScoreStore.getState().player
      if (!containerRef.current || !player || !musicXml) return

      const { events } = parseMusicXmlForEvents(musicXml)
      const noteEls = Array.from(
        containerRef.current.querySelectorAll(
          'svg [class*=note], svg [class*=notehead]'
        )
      ) as HTMLElement[]

      const handlers: Array<() => void> = []
      for (let i = 0; i < Math.min(noteEls.length, events.length); i++) {
        const el = noteEls[i]
        const ev = events[i]
        const cb = () => {
          if (typeof player.playNote === 'function') {
            const noteName = midiToNoteName(ev.midi)
            player.playNote(noteName, ev.duration || 0.5)
          }
          // quick visual flash
          el.classList.add('musescore-player-note-pressed')
          setTimeout(
            () => el.classList.remove('musescore-player-note-pressed'),
            150
          )
        }
        el.addEventListener('click', cb)
        handlers.push(() => el.removeEventListener('click', cb))
      }

      return () => {
        handlers.forEach((h) => h())
      }
    } catch (e) {
      console.warn('Note click handler setup error:', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, musicXml, osmdRef])

  return (
    <section className="w-full">
      {renderError ? (
        <Alert variant="error">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{renderError}</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white">
          <div
            ref={containerRef}
            className="w-full"
            role="img"
            aria-label="楽譜表示エリア"
          />
          {isLoadingScore && (
            <Alert variant="info">
              <AlertTitle>処理中...</AlertTitle>
              <AlertDescription>
                楽譜ファイルを読み込んで MusicXML に変換しています
              </AlertDescription>
            </Alert>
          )}
          <ControlModal />
        </div>
      )}

      <style jsx>{`
        :global(.musescore-player-highlight) {
          fill: rgba(255, 255, 0, 0.3) !important;
          stroke: rgba(255, 200, 0, 0.8) !important;
          stroke-width: 2px !important;
          animation: pulse-highlight 0.4s ease-in-out;
        }

        :global(.musescore-player-note-pressed) {
          fill: rgba(100, 200, 255, 0.6) !important;
          animation: note-press 0.15s ease-out;
        }

        @keyframes pulse-highlight {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes note-press {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </section>
  )
}
