import { useCallback, useEffect, useRef, useState } from 'react'

import type { Cursor } from 'opensheetmusicdisplay'
import { useShallow } from 'zustand/shallow'

import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useNoteInteraction } from '../hooks/useNoteInteraction'
import { DEFAULT_SCORE_ZOOM, useOSMD } from '../hooks/useOSMD'
import {
  type NoteEvent,
  type TempoChange,
  parseMusicXmlForEvents,
} from '../lib/musicXmlParser'
import { useScoreStore } from '../stores/useScoreStore'
import { ControlModal } from './controlModal/ControlModal'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

const TICKS_PER_QUARTER = 192
const OSMD_TIMESTAMP_TO_TICKS = 4 * TICKS_PER_QUARTER
const CURSOR_ADVANCE_LIMIT = 10000
const MIN_CURSOR_WIDTH_PX = 4
const SCORE_ZOOM_STEP_PERCENTAGE = 15
const MIN_SCORE_ZOOM_PERCENTAGE = 25
const MAX_SCORE_ZOOM_PERCENTAGE = 250
const EMPTY_NOTE_EVENTS: NoteEvent[] = []

type ParsedEventsState = {
  musicXml: string
  events: NoteEvent[]
  tempoChanges: TempoChange[]
}

const getCursorTicks = (cursor: Cursor): number | null => {
  try {
    return Math.round(
      cursor.Iterator.CurrentSourceTimestamp.RealValue * OSMD_TIMESTAMP_TO_TICKS
    )
  } catch {
    return null
  }
}

const syncCursorImageSize = (cursorElement?: HTMLImageElement | null) => {
  if (!cursorElement) return

  const width = cursorElement.getAttribute('width')
  const height = cursorElement.getAttribute('height')

  if (width) {
    const widthPx = Number(width)
    cursorElement.style.width = `${
      Number.isFinite(widthPx)
        ? Math.max(widthPx, MIN_CURSOR_WIDTH_PX)
        : MIN_CURSOR_WIDTH_PX
    }px`
  }
  if (height) {
    cursorElement.style.height = `${height}px`
  }

  cursorElement.style.maxWidth = 'none'
}

export const ScorePreview = () => {
  console.log('[ScorePreview] rendering...')
  const lastCursorEventTimeRef = useRef<number | null>(null)
  const lastCursorTopRef = useRef<string | null>(null)
  const scoreZoomPercentageRef = useRef(100)
  const zoomRenderFrameRef = useRef<number | null>(null)
  const [scoreZoomPercentage, setScoreZoomPercentage] = useState(100)
  const [isZoomRendering, setIsZoomRendering] = useState(false)
  const { musicXml, musicMxl, isLoading } = useScoreStore(
    useShallow((state) => ({
      musicXml: state.musicXml,
      musicMxl: state.musicMxl,
      isLoading: state.isLoading,
    }))
  )

  const { containerRef, renderError, isRendering, osmdRef } = useOSMD(
    musicXml,
    musicMxl,
    (DEFAULT_SCORE_ZOOM * scoreZoomPercentage) / 100
  )

  useEffect(() => {
    return () => {
      if (zoomRenderFrameRef.current !== null) {
        cancelAnimationFrame(zoomRenderFrameRef.current)
      }
    }
  }, [])

  const [parsedEventsState, setParsedEventsState] =
    useState<ParsedEventsState | null>(null)
  const parsedEvents =
    musicXml && parsedEventsState?.musicXml === musicXml
      ? parsedEventsState.events
      : EMPTY_NOTE_EVENTS
  const tempoChanges =
    musicXml && parsedEventsState?.musicXml === musicXml
      ? parsedEventsState.tempoChanges
      : []

  useEffect(() => {
    if (!musicXml) return

    let cancelled = false
    void parseMusicXmlForEvents(musicXml)
      .then(({ events, tempoChanges: parsedTempoChanges }) => {
        if (!cancelled) {
          setParsedEventsState({
            musicXml,
            events,
            tempoChanges: parsedTempoChanges,
          })
        }
      })
      .catch((error: unknown) => {
        console.error('MusicXML event parsing failed:', error)
        if (!cancelled) {
          setParsedEventsState({
            musicXml,
            events: EMPTY_NOTE_EVENTS,
            tempoChanges: [],
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [musicXml])

  const followPlaybackCursor = useCallback(
    (cursorElement?: HTMLImageElement | null) => {
      if (!cursorElement) return

      const cursorTop = cursorElement.style.top
      if (!cursorTop || cursorTop === lastCursorTopRef.current) return

      lastCursorTopRef.current = cursorTop
      const headerHeight =
        document.querySelector<HTMLElement>('[data-app-header]')
          ?.offsetHeight ?? 0
      cursorElement.style.scrollMarginTop = `${headerHeight + 60}px`
      cursorElement.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: 'auto',
      })
    },
    []
  )

  const syncPlaybackCursor = useCallback(
    (eventTime: number) => {
      const cursor = osmdRef.current?.cursor
      if (!cursor) return

      const targetTicks = Math.max(0, Math.round(eventTime))
      if (lastCursorEventTimeRef.current === targetTicks) {
        return
      }

      const initialCursorTicks = getCursorTicks(cursor)
      if (
        initialCursorTicks === null ||
        initialCursorTicks > targetTicks ||
        (lastCursorEventTimeRef.current !== null &&
          lastCursorEventTimeRef.current > targetTicks)
      ) {
        cursor.reset()
      }

      cursor.show()

      let cursorTicks = getCursorTicks(cursor)
      let advanceCount = 0
      while (
        cursorTicks !== null &&
        cursorTicks < targetTicks &&
        !cursor.Iterator.EndReached &&
        advanceCount < CURSOR_ADVANCE_LIMIT
      ) {
        cursor.next()
        cursorTicks = getCursorTicks(cursor)
        advanceCount += 1
      }

      syncCursorImageSize(cursor.cursorElement)
      followPlaybackCursor(cursor.cursorElement)
      lastCursorEventTimeRef.current = targetTicks
    },
    [followPlaybackCursor, osmdRef]
  )

  const startPlaybackCursor = useCallback(
    (startTicks: number) => {
      const cursor = osmdRef.current?.cursor
      if (!cursor) return

      lastCursorEventTimeRef.current = null
      lastCursorTopRef.current = null

      if (startTicks > 0) {
        syncPlaybackCursor(startTicks)
        return
      }

      cursor.reset()
      cursor.show()
      syncCursorImageSize(cursor.cursorElement)
      followPlaybackCursor(cursor.cursorElement)
    },
    [followPlaybackCursor, osmdRef, syncPlaybackCursor]
  )

  const { play, stop, playNote, mixerControls, playbackControls } =
    useAudioPlayer(parsedEvents, {
      tempoChanges,
      onNoteStart: (event) => syncPlaybackCursor(event.time),
      onPlaybackStart: startPlaybackCursor,
      onPlaybackStop: () => {
        lastCursorEventTimeRef.current = null
        lastCursorTopRef.current = null
        osmdRef.current?.cursor?.hide()
      },
      onSeek: syncPlaybackCursor,
    })

  const { handlePointerDown, handlePointerUp } = useNoteInteraction(
    containerRef,
    osmdRef,
    parsedEvents,
    playNote
  )

  const changeScoreZoom = useCallback(
    (delta: number) => {
      const nextZoomPercentage = Math.min(
        MAX_SCORE_ZOOM_PERCENTAGE,
        Math.max(
          MIN_SCORE_ZOOM_PERCENTAGE,
          scoreZoomPercentageRef.current + delta
        )
      )
      if (nextZoomPercentage === scoreZoomPercentageRef.current) return

      scoreZoomPercentageRef.current = nextZoomPercentage
      setScoreZoomPercentage(nextZoomPercentage)
      setIsZoomRendering(true)

      // まず数値を描画し、その次のフレームで楽譜を更新する。
      if (zoomRenderFrameRef.current !== null) return

      zoomRenderFrameRef.current = requestAnimationFrame(() => {
        zoomRenderFrameRef.current = requestAnimationFrame(() => {
          zoomRenderFrameRef.current = null

          const osmd = osmdRef.current
          if (!osmd) {
            setIsZoomRendering(false)
            return
          }

          try {
            osmd.zoom =
              (DEFAULT_SCORE_ZOOM * scoreZoomPercentageRef.current) / 100
            osmd.render()
          } finally {
            setIsZoomRendering(false)
          }
        })
      })
    },
    [osmdRef]
  )

  const zoomIn = useCallback(
    () => changeScoreZoom(SCORE_ZOOM_STEP_PERCENTAGE),
    [changeScoreZoom]
  )
  const zoomOut = useCallback(
    () => changeScoreZoom(-SCORE_ZOOM_STEP_PERCENTAGE),
    [changeScoreZoom]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let overlay: HTMLDivElement | null = null
    let wasPlaying = useScoreStore.getState().isPlaying
    const addOverlay = () => {
      if (overlay || !container) return
      overlay = document.createElement('div')
      overlay.style.position = 'absolute'
      overlay.style.inset = '0'
      overlay.style.zIndex = '10'
      overlay.style.touchAction = 'manipulation'
      container.appendChild(overlay)
    }
    const removeOverlay = () => {
      if (!overlay) return
      overlay.remove()
      overlay = null
    }
    if (wasPlaying) addOverlay()
    const unsubscribe = useScoreStore.subscribe((state) => {
      if (state.isPlaying === wasPlaying) return
      wasPlaying = state.isPlaying
      if (state.isPlaying) {
        addOverlay()
      } else {
        removeOverlay()
      }
    })
    return () => {
      unsubscribe()
      removeOverlay()
    }
  }, [containerRef])

  const isLoadingScore = Boolean((isLoading || isRendering) && !musicXml)

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
            className="score-preview relative w-full bg-white"
            style={{
              touchAction: 'manipulation',
              willChange: 'transform',
              transform: 'translate3d(0, 0, 0)',
            }}
            role="img"
            aria-label="楽譜表示エリア"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          />
          {isLoadingScore && (
            <Alert variant="info">
              <AlertTitle>処理中...</AlertTitle>
              <AlertDescription>
                楽譜ファイルを読み込んで MusicXML に変換しています
              </AlertDescription>
            </Alert>
          )}
          <ControlModal
            play={play}
            stop={stop}
            mixerControls={mixerControls}
            playbackControls={playbackControls}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            zoomPercentage={scoreZoomPercentage}
            isZoomRendering={isZoomRendering}
          />
        </div>
      )}
    </section>
  )
}
