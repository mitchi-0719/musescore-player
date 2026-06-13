import {
  type MouseEventHandler,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react'

import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

import type { NoteEvent } from '../lib/musicXmlParser'
import { useScoreStore } from '../stores/useScoreStore'
import type { PlayNoteFn } from './useAudioPlayer'

const STAFFLINE_SELECTOR = '[class~="staffline"]'
const NOTE_SELECTOR = '.vf-stavenote'
const SELECTED_NOTE_CLASS = 'osmd-note-selected'

const sortEventsForSvgOrder = (events: NoteEvent[]) =>
  events
    .slice()
    .sort(
      (a, b) =>
        a.measureNumber - b.measureNumber ||
        a.voice.localeCompare(b.voice) ||
        a.time - b.time ||
        a.partId.localeCompare(b.partId)
    )

const getUniquePartIds = (events: NoteEvent[]) => {
  return Array.from(new Set(events.map((event) => event.partId)))
}

const getPartIdsFromScore = (
  osmd: OpenSheetMusicDisplay | null,
  events: NoteEvent[]
) => {
  const instrumentIds = osmd?.Sheet?.Instruments.map((instrument) => {
    return instrument.IdString
  }).filter((partId): partId is string => partId.length > 0)

  return instrumentIds && instrumentIds.length > 0
    ? instrumentIds
    : getUniquePartIds(events)
}

export const useNoteInteraction = (
  containerRef: RefObject<HTMLDivElement | null>,
  osmdRef: RefObject<OpenSheetMusicDisplay | null>,
  parsedEvents: NoteEvent[],
  playNote: PlayNoteFn | null
) => {
  const setSelectedNoteId = useScoreStore((state) => state.setSelectedNoteId)
  const selectedNoteIdRef = useRef<string | null>(null)
  const noteEventMapRef = useRef<Map<string, NoteEvent[]>>(new Map())

  const syncSelectedClass = useCallback(
    (root: HTMLDivElement | null, noteId: string | null) => {
      if (!root) return

      const noteElements = Array.from(root.querySelectorAll('[data-note-id]'))
      noteElements.forEach((noteElement) => {
        const isSelected = noteElement.getAttribute('data-note-id') === noteId
        noteElement.classList.toggle(SELECTED_NOTE_CLASS, isSelected)
      })
    },
    []
  )

  const assignNoteIds = useCallback(() => {
    const root = containerRef.current
    if (!root || parsedEvents.length === 0) {
      noteEventMapRef.current = new Map()
      return
    }

    const stafflines = Array.from(root.querySelectorAll(STAFFLINE_SELECTOR))
    if (stafflines.length === 0) {
      noteEventMapRef.current = new Map()
      return
    }

    const sortedEvents = sortEventsForSvgOrder(parsedEvents)
    const partIds = getPartIdsFromScore(osmdRef.current, sortedEvents)
    if (partIds.length === 0) {
      noteEventMapRef.current = new Map()
      return
    }

    const eventsByPartId = new Map<string, NoteEvent[]>()
    partIds.forEach((partId) => {
      eventsByPartId.set(partId, [])
    })

    sortedEvents.forEach((event) => {
      const partEvents = eventsByPartId.get(event.partId)
      if (partEvents) {
        partEvents.push(event)
      }
    })

    const eventOffsets = new Map<string, number>()
    partIds.forEach((partId) => {
      eventOffsets.set(partId, 0)
    })

    noteEventMapRef.current = new Map()

    stafflines.forEach((staffline, stafflineIndex) => {
      const partId = partIds[stafflineIndex % partIds.length]
      const partEvents = eventsByPartId.get(partId) || []
      let eventOffset = eventOffsets.get(partId) || 0

      staffline.setAttribute('data-part-id', partId)

      const noteElements = Array.from(staffline.querySelectorAll(NOTE_SELECTOR))
      noteElements.forEach((noteElement) => {
        const event = partEvents[eventOffset]
        if (!event) return

        const chordEvents: NoteEvent[] = [event]
        let nextIdx = eventOffset + 1
        while (nextIdx < partEvents.length) {
          const next = partEvents[nextIdx]
          if (next.time === event.time && next.voice === event.voice) {
            chordEvents.push(next)
            nextIdx++
          } else {
            break
          }
        }

        const noteId = `${partId}:${eventOffset}`
        noteElement.setAttribute('data-part-id', partId)
        noteElement.setAttribute('data-note-id', noteId)
        noteElement.classList.toggle(
          SELECTED_NOTE_CLASS,
          noteId === selectedNoteIdRef.current
        )

        noteEventMapRef.current.set(noteId, chordEvents)
        eventOffset = nextIdx
      })

      eventOffsets.set(partId, eventOffset)
    })

    syncSelectedClass(root, selectedNoteIdRef.current)
  }, [containerRef, osmdRef, parsedEvents, syncSelectedClass])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    // 初期化時の値を反映
    const initialNoteId = useScoreStore.getState().selectedNoteId
    selectedNoteIdRef.current = initialNoteId
    syncSelectedClass(root, initialNoteId)

    const unsubscribe = useScoreStore.subscribe((state) => {
      const nextSelectedNoteId = state.selectedNoteId
      if (nextSelectedNoteId !== selectedNoteIdRef.current) {
        selectedNoteIdRef.current = nextSelectedNoteId
        syncSelectedClass(root, nextSelectedNoteId)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [containerRef, syncSelectedClass])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const refresh = () => {
      assignNoteIds()
    }

    refresh()

    const observer = new MutationObserver(() => {
      refresh()
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [assignNoteIds, containerRef])

  const playClickedNote = useCallback(
    (clickedNote: Element) => {
      const noteId = clickedNote.getAttribute('data-note-id')
      if (!noteId) return

      const events = noteEventMapRef.current.get(noteId)
      if (!events || events.length === 0) return

      // 休符・音符どちらでも選択状態（色）は更新する
      setSelectedNoteId(noteId)

      // 再生可能なイベント（休符・タイ継続を除く）をフィルタリング
      const playableEvents = events.filter(
        (e) => !e.isRest && !e.isTieContinuation
      )
      if (playableEvents.length === 0) return
      if (typeof playNote !== 'function') return

      // 和音の場合は全ての音を同時に鳴らす
      playableEvents.forEach((event) => {
        playNote(event.samplerId, event.playbackKey, event.duration)
      })
    },
    [playNote, setSelectedNoteId]
  )

  const handleScoreClick: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      // 再生中ならスクロール等の誤タッチを検知しないよう、タップイベントを即座に無視する
      if (useScoreStore.getState().isPlaying) {
        console.log(
          '[NoteClick] Tap ignored because score playback is in progress'
        )
        return
      }

      if (!containerRef.current) return
      if (!(e.target instanceof Element)) return
      const clickTarget = e.target

      const clickX = e.clientX
      const clickY = e.clientY

      console.log('[NoteClick] tap at', {
        clickX,
        clickY,
        target: clickTarget.tagName,
        className: clickTarget.className,
      })

      const directNote = clickTarget.closest('[data-note-id]')
      if (directNote) {
        const noteId = directNote.getAttribute('data-note-id')
        const rect = directNote.getBoundingClientRect()
        console.log('[NoteClick] DIRECT HIT', {
          noteId,
          rect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
          distFromCenter: Math.hypot(
            clickX - (rect.left + rect.width / 2),
            clickY - (rect.top + rect.height / 2)
          ),
        })
        playClickedNote(directNote)
        return
      }

      // タップ位置に最も近いノートを探索
      const HIT_RADIUS = 48

      const allNotes = Array.from(
        containerRef.current.querySelectorAll('[data-note-id]')
      )
      console.log(
        '[NoteClick] no direct hit, searching',
        allNotes.length,
        'notes within radius',
        HIT_RADIUS
      )

      if (allNotes.length === 0) return

      let closest: Element | null = null
      let minRectDist = Infinity
      let minCenterDist = Infinity

      // デバッグ: 上位候補を記録
      const top3: { noteId: string | null; rDist: number; cDist: number }[] = []

      for (const note of allNotes) {
        const rect = note.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2

        // バウンディングボックスの辺への最短距離（内部にいる場合は0）
        const dx = Math.max(rect.left - clickX, 0, clickX - rect.right)
        const dy = Math.max(rect.top - clickY, 0, clickY - rect.bottom)
        const rDist = Math.sqrt(dx * dx + dy * dy)

        // 中心への距離（タイブレーク用）
        const cDist = Math.hypot(clickX - cx, clickY - cy)

        if (rDist <= HIT_RADIUS) {
          top3.push({
            noteId: note.getAttribute('data-note-id'),
            rDist: Math.round(rDist * 10) / 10,
            cDist: Math.round(cDist * 10) / 10,
          })
        }

        if (rDist <= HIT_RADIUS) {
          if (
            rDist < minRectDist ||
            (rDist === minRectDist && cDist < minCenterDist)
          ) {
            minRectDist = rDist
            minCenterDist = cDist
            closest = note
          }
        }
      }

      top3.sort((a, b) => {
        if (a.rDist !== b.rDist) return a.rDist - b.rDist
        return a.cDist - b.cDist
      })
      console.log('[NoteClick] candidates within radius:', top3.slice(0, 5))

      if (closest) {
        const noteId = closest.getAttribute('data-note-id')
        console.log('[NoteClick] PROXIMITY HIT', {
          noteId,
          rDist: Math.round(minRectDist * 10) / 10,
          cDist: Math.round(minCenterDist * 10) / 10,
        })
        playClickedNote(closest)
      } else {
        console.log('[NoteClick] no note found within radius')
      }
    },
    [containerRef, playClickedNote]
  )
  return { handleScoreClick }
}
