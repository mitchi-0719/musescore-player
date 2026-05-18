'use client'
import { MouseEventHandler, useEffect, useRef } from 'react'

import { midiToNoteName, parseMusicXmlForEvents } from '@/hooks/useAudioPlayer'
import { useOSMD } from '@/hooks/useOSMD'
import { Timemap } from '@/hooks/useVerovio'
import { extractHarmonyLabels } from '@/lib/audioSync'
import { useScoreStore } from '@/stores/useScoreStore'

import AudioPlayer from './AudioPlayer'
import { ControlModal } from './ControlModal'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

export const ScorePreview = () => {
  const musicXml = useScoreStore((state) => state.musicXml)
  const musicMxl = useScoreStore((state) => state.musicMxl)
  const timemap = useScoreStore((state) => state.timemap)

  // Verovio SVG レンダリング用の ref
  const svgContainerRef = useRef<HTMLDivElement | null>(null)

  const { containerRef, renderError, isRendering, osmdRef } = useOSMD(
    musicXml,
    musicMxl
  )
  const currentTime = useScoreStore((s) => s.currentTime)
  const highlightedMeasureNumber = useScoreStore(
    (s) => s.highlightedMeasureNumber
  )

  const isLoading = useScoreStore((s) => s.isLoading)
  const fileName = useScoreStore((s) => s.fileName)

  const isLoadingScore = Boolean((isLoading || isRendering) && !musicXml)

  /**
   * Verovio SVG のクリックハンドラ
   * .note 要素をターゲットにして、data-note-id を抽出
   */
  const attachNoteClickHandler = (containerElement: HTMLDivElement) => {
    const handleClick = (e: Event) => {
      if (!(e instanceof MouseEvent)) return
      const target = e.target as Element

      // Verovio SVG 内の note 要素を検索
      const noteElement = target.closest('.note, [data-note-id]')

      if (noteElement) {
        const noteId = noteElement.getAttribute('data-note-id')
        if (noteId && timemap) {
          const noteData = timemap[noteId]
          if (noteData) {
            const player = useScoreStore.getState().player
            if (player && typeof player.playNote === 'function') {
              // Timemap から MIDI ノート番号を推定（簡易実装）
              // TODO: Verovio timemap から正確な MIDI 値を抽出する処理を追加
              player.playNote(noteId, 0.5)
            }
          }
        }
      }
    }

    containerElement.addEventListener('click', handleClick)

    return () => {
      containerElement.removeEventListener('click', handleClick)
    }
  }

  // Verovio SVG が更新されたときに、クリックハンドラを再登録
  useEffect(() => {
    if (!svgContainerRef.current) return

    const cleanup = attachNoteClickHandler(svgContainerRef.current)
    return cleanup
  }, [timemap])

  /**
   * 既存の OSMD ベースのクリックハンドラ（Phase 1 では保持）
   */
  const handleScoreClick: MouseEventHandler<HTMLDivElement> = (e) => {
    if (!containerRef.current) return
    const target = e.target as Element

    let hitNote: Element | null = null

    const directNote = target.closest('.vf-stavenote')
    if (directNote) {
      playClickedNote(directNote)
      return
    }

    const clickX = e.clientX
    const clickY = e.clientY
    const HIT_RADIUS = 40

    const measures = containerRef.current.querySelectorAll(
      '.vf-measure, .vf-stave'
    )
    let targetMeasure: Element | null = null

    for (const measure of measures) {
      const rect = measure.getBoundingClientRect()

      if (
        clickX >= rect.left &&
        clickX <= rect.right &&
        clickY >= rect.top - HIT_RADIUS &&
        clickY <= rect.bottom + HIT_RADIUS
      ) {
        targetMeasure = measure
        break
      }
    }

    if (targetMeasure) {
      const notesInMeasure = targetMeasure.querySelectorAll('.vf-stavenote')
      let minDistance = Infinity

      notesInMeasure.forEach((note) => {
        const rect = note.getBoundingClientRect()
        const noteCenterX = rect.left + rect.width / 2
        const noteCenterY = rect.top + rect.height / 2

        const distance = Math.sqrt(
          Math.pow(clickX - noteCenterX, 2) + Math.pow(clickY - noteCenterY, 2)
        )

        if (distance <= HIT_RADIUS && distance < minDistance) {
          minDistance = distance
          hitNote = note
        }
      })
    }

    if (hitNote) {
      playClickedNote(hitNote)
    }
  }

  const playClickedNote = (clickedNote: Element) => {
    const player = useScoreStore.getState().player
    if (!containerRef.current || !player || !musicXml) return

    // 既存のパース処理
    const { events } = parseMusicXmlForEvents(musicXml)

    // イベント配列とDOMのインデックスを合わせるための全取得
    const allNotes = Array.from(
      containerRef.current.querySelectorAll(
        'svg [class*=note], svg [class*=notehead]'
      )
    )

    // クリックされた音符が、楽譜全体の中で「何番目」の要素かを特定する
    // （※クリック時のみ実行される O(N) なので、6000個あっても1ミリ秒以下で終わります）
    const index = allNotes.indexOf(clickedNote as HTMLElement)

    if (index !== -1 && events[index]) {
      const ev = events[index]
      if (typeof player.playNote === 'function') {
        const noteName = midiToNoteName(ev.midi)
        player.playNote(noteName, ev.duration || 0.5)
      }
    }
  }

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

  // OSMD が N.C. を描画してしまう場合は、MusicXML の harmony 情報で上書きする
  useEffect(() => {
    if (!containerRef.current || !musicXml || isRendering) return

    const frame = requestAnimationFrame(() => {
      try {
        const labels = extractHarmonyLabels(musicXml)
        if (labels.length === 0) return

        const chordNodes = Array.from(
          containerRef.current?.querySelectorAll('svg text') || []
        ).filter((node) => (node.textContent || '').trim() === 'N.C.')

        chordNodes.forEach((node, index) => {
          const label = labels[index]
          if (label && label !== 'N.C.') {
            node.textContent = label
          }
        })
      } catch (error) {
        console.warn('Chord label rewrite error:', error)
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [musicXml, isRendering])

  return (
    <section className="w-full">
      {renderError ? (
        <Alert variant="error">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{renderError}</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white">
          {!isRendering && (
            <div className="mt-3 px-4">
              <AudioPlayer osmdRef={osmdRef} />
            </div>
          )}
          {/* Verovio SVG コンテナ（Phase 2 以降で使用） */}
          <div
            ref={svgContainerRef}
            className="w-full"
            role="img"
            aria-label="Verovio楽譜表示エリア"
            style={{ display: timemap ? 'block' : 'none' }}
          />
          {/* OSMD SVG コンテナ（Phase 1 では継続使用） */}
          <div
            ref={containerRef}
            className="w-full"
            role="img"
            aria-label="楽譜表示エリア"
            onClick={handleScoreClick}
            style={{ display: timemap ? 'none' : 'block' }}
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
    </section>
  )
}
