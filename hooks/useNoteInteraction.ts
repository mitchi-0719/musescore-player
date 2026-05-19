import { MouseEventHandler, RefObject, useCallback } from 'react'

import { PlayerHandle } from '@/stores/useScoreStore'

import { NoteEvent, midiToNoteName } from './useAudioPlayer'

export const useNoteInteraction = (
  containerRef: RefObject<HTMLDivElement | null>,
  parsedEvents: NoteEvent[],
  player: PlayerHandle | null
) => {
  const playClickedNote = useCallback(
    (clickedNote: Element) => {
      if (!containerRef.current || !player || parsedEvents.length === 0) return

      // DOMから音符要素を取得
      const allNotes = Array.from(
        containerRef.current.querySelectorAll(
          'svg [class*=note], svg [class*=notehead]'
        )
      )
      const index = allNotes.indexOf(clickedNote as HTMLElement)

      if (index !== -1 && parsedEvents[index]) {
        const ev = parsedEvents[index]
        if (typeof player.playNote === 'function') {
          const noteName = midiToNoteName(ev.midi)
          player.playNote(noteName, ev.duration || 0.5)
        }
      }
    },
    [containerRef, parsedEvents, player]
  )

  const handleScoreClick: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
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
            Math.pow(clickX - noteCenterX, 2) +
              Math.pow(clickY - noteCenterY, 2)
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
    },
    [containerRef, playClickedNote]
  )
  return { handleScoreClick }
}
