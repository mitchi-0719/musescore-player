import { type MouseEventHandler, type RefObject, useCallback } from 'react'

import type { NoteEvent } from '../lib/musicXmlParser'
import type { PlayNoteFn } from './useAudioPlayer'

export const useNoteInteraction = (
  containerRef: RefObject<HTMLDivElement | null>,
  parsedEvents: NoteEvent[],
  playNote: PlayNoteFn | null
) => {
  const playClickedNote = useCallback(
    (clickedNote: Element) => {
      if (
        !containerRef.current ||
        typeof playNote !== 'function' ||
        parsedEvents.length === 0
      )
        return

      // Build a stable DOM note list and map to sorted parsed events
      const selector =
        '.vf-stavenote, .vf-notehead, .vf-note, svg [class*=note], svg [class*=notehead]'
      const allNotes = Array.from(
        containerRef.current.querySelectorAll(selector)
      ) as Element[]

      if (allNotes.length === 0) return

      // parsedEvents are expected to be sorted by time; ensure consistent ordering
      const events = parsedEvents
        .slice()
        .sort(
          (a, b) =>
            a.time - b.time ||
            a.partId.localeCompare(b.partId) ||
            a.voice.localeCompare(b.voice)
        )

      const idx = allNotes.indexOf(clickedNote as Element)
      const ev = idx !== -1 && events[idx] ? events[idx] : null

      if (ev) {
        playNote(ev.samplerId, ev.playbackKey, ev.duration)
      }
    },
    [containerRef, parsedEvents, playNote]
  )

  const handleScoreClick: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (!containerRef.current) return
      const clickTarget = e.target as Element

      // If user clicked directly on a note element, prefer that
      const directNote = clickTarget.closest('.vf-stavenote')
      if (directNote) {
        console.log('Direct note hit:', directNote)
        playClickedNote(directNote)
        return
      }

      const clickX = e.clientX
      const clickY = e.clientY
      const HIT_RADIUS = 48

      const selector = '.vf-stavenote'
      const allNotes = Array.from(
        containerRef.current.querySelectorAll(selector)
      ) as Element[]
      if (allNotes.length === 0) return

      let closest: Element | null = null
      let minDistance = Infinity

      allNotes.forEach((note) => {
        const rect = note.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const d = Math.hypot(clickX - cx, clickY - cy)
        if (d <= HIT_RADIUS && d < minDistance) {
          minDistance = d
          closest = note
        }
      })

      if (closest) {
        console.log('Closest note hit:', closest)
        playClickedNote(closest)
      }
    },
    [containerRef, playClickedNote]
  )
  return { handleScoreClick }
}
