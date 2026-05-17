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

  const isLoading = useScoreStore((s) => s.isLoading)
  const fileName = useScoreStore((s) => s.fileName)

  const isLoadingScore = Boolean((isLoading || isRendering) && !musicXml)

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
        // 安全なインデックス計算: 小数は切り捨てて measure の数で mod
        const idx = Math.floor(currentTime) % measures.length
        const el = measures[idx]
        if (el) el.classList.add('musescore-player-highlight')
      }
    } catch (e) {
      // ignore
    }
  }, [currentTime])

  useEffect(() => {
    // Attach click handlers to rendered note elements to play individual notes.
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
      // ignore
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
          <div ref={containerRef} className="w-full" />
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
    </section>
  )
}
