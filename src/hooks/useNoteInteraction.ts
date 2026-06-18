import {
  type PointerEventHandler,
  type RefObject,
  useCallback,
  useRef,
} from 'react'

import { OpenSheetMusicDisplay, PointF2D } from 'opensheetmusicdisplay'

import type { NoteEvent } from '../lib/musicXmlParser'
import { useScoreStore } from '../stores/useScoreStore'
import type { PlayNoteFn } from './useAudioPlayer'

const SEMITONE_TO_NOTE = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

const getSvgElement = (note: object): SVGElement | null => {
  if ('getSVGGElement' in note && typeof note.getSVGGElement === 'function') {
    return note.getSVGGElement() as SVGElement | null
  }
  return null
}

const clearNoteHighlight = (note: object) => {
  const svgElement = getSvgElement(note)
  if (svgElement) {
    svgElement.style.fill = ''
    svgElement.style.stroke = ''
    const children = svgElement.querySelectorAll('*')
    children.forEach((child) => {
      if (child instanceof SVGElement || child instanceof HTMLElement) {
        child.style.fill = ''
        child.style.stroke = ''
      }
    })
  } else if ('setColor' in note && typeof note.setColor === 'function') {
    try {
      note.setColor('#000000', {
        applyToBeams: true,
        applyToFlag: true,
        applyToNoteheads: true,
        applyToStem: true,
        applyToTies: true,
      })
    } catch {
      // ignore
    }
  }
}

const applyNoteHighlight = (note: object) => {
  const svgElement = getSvgElement(note)
  if (svgElement) {
    svgElement.style.fill = '#FF0000'
    svgElement.style.stroke = '#FF0000'
    const children = svgElement.querySelectorAll('*')
    children.forEach((child) => {
      if (child instanceof SVGElement || child instanceof HTMLElement) {
        child.style.fill = '#FF0000'
        child.style.stroke = '#FF0000'
      }
    })
  } else if ('setColor' in note && typeof note.setColor === 'function') {
    try {
      note.setColor('#FF0000', {
        applyToBeams: true,
        applyToFlag: true,
        applyToNoteheads: true,
        applyToStem: true,
        applyToTies: true,
      })
    } catch {
      // ignore
    }
  }
}

export const useNoteInteraction = (
  containerRef: RefObject<HTMLDivElement | null>,
  osmdRef: RefObject<OpenSheetMusicDisplay | null>,
  parsedEvents: NoteEvent[],
  playNote: PlayNoteFn | null
) => {
  const previousNoteRef = useRef<object | null>(null)

  const handleScoreClick: PointerEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (useScoreStore.getState().isPlaying) {
        // console.log(
        //   '[NoteClick] Tap ignored because score playback is in progress'
        // )
        return
      }

      if (!containerRef.current || !osmdRef.current) return

      const osmd = osmdRef.current
      const svg = containerRef.current.querySelector('svg')
      if (!svg) return

      const svgRect = svg.getBoundingClientRect()

      const osmdX = (e.clientX - svgRect.left) / (10 * osmd.zoom)
      const osmdY = (e.clientY - svgRect.top) / (10 * osmd.zoom)

      const clickPoint = new PointF2D(osmdX, osmdY)
      const maxDistance = new PointF2D(3, 3)

      const graphicalNote = osmd.GraphicSheet.GetNearestNote(
        clickPoint,
        maxDistance
      )

      if (!graphicalNote) {
        // console.log('[NoteClick] No note found near the click point.')
        return
      }

      const sourceNote = graphicalNote.sourceNote

      // 前回のハイライトを解除
      if (
        previousNoteRef.current &&
        previousNoteRef.current !== graphicalNote
      ) {
        clearNoteHighlight(previousNoteRef.current)
      }

      // 今回の音符をハイライト
      applyNoteHighlight(graphicalNote)
      previousNoteRef.current = graphicalNote

      if (sourceNote.isRest()) {
        // console.log('[NoteClick] Clicked on a rest.')
        return
      }

      // OSMDの表示ピッチから推定される note string を計算
      const pitch = sourceNote.TransposedPitch || sourceNote.Pitch
      let osmdPitchStr = ''

      if (pitch) {
        const fundamental = pitch.FundamentalNote
        const octave = pitch.Octave
        const alter = pitch.AccidentalHalfTones

        const semitone = fundamental + alter
        const octaveShift = Math.floor(semitone / 12)
        const normalizedSemitone = ((semitone % 12) + 12) % 12
        const finalOctave = octave + octaveShift

        osmdPitchStr = `${SEMITONE_TO_NOTE[normalizedSemitone]}${finalOctave}`
      } else if (
        'displayStepUnpitched' in sourceNote &&
        sourceNote.displayStepUnpitched !== undefined
      ) {
        const rawNote = sourceNote as {
          displayStepUnpitched: number
          displayOctaveUnpitched?: number
        }
        const fundamental = rawNote.displayStepUnpitched
        const octave = rawNote.displayOctaveUnpitched ?? 4
        const semitone = fundamental
        const octaveShift = Math.floor(semitone / 12)
        const normalizedSemitone = ((semitone % 12) + 12) % 12
        const finalOctave = octave + octaveShift

        osmdPitchStr = `${SEMITONE_TO_NOTE[normalizedSemitone]}${finalOctave}`
      }

      let partId = ''
      try {
        if (sourceNote.ParentStaff?.ParentInstrument?.IdString) {
          partId = sourceNote.ParentStaff.ParentInstrument.IdString
        }
      } catch {
        console.warn('Could not extract part ID from sourceNote.')
      }

      let voiceId = ''
      try {
        if (sourceNote.ParentVoiceEntry?.ParentVoice?.VoiceId !== undefined) {
          voiceId = String(sourceNote.ParentVoiceEntry.ParentVoice.VoiceId)
        }
      } catch {
        console.warn('Could not extract voice ID from sourceNote.')
      }

      // parsedEventsの中から、クリックした音符に該当するイベントを探す
      const measureNum = sourceNote.SourceMeasure.MeasureNumber
      const timeInTicks = Math.round(
        sourceNote.getAbsoluteTimestamp().RealValue * 4 * 192
      )

      // 声部(Voice)も一致するイベントを優先してフィルタリング
      let eventsInMeasure = parsedEvents.filter(
        (ev) =>
          ev.measureNumber === measureNum &&
          (!partId || ev.partId === partId) &&
          (!voiceId || ev.voice === voiceId)
      )

      // 声部フィルタで候補が空になった場合は、声部フィルタなしでフォールバック
      if (eventsInMeasure.length === 0) {
        eventsInMeasure = parsedEvents.filter(
          (ev) =>
            ev.measureNumber === measureNum && (!partId || ev.partId === partId)
        )
      }

      // タイ継続音 (isTieContinuation) もマッチング対象に含める (isRest のみ除外)
      const activeEventsInMeasure = eventsInMeasure.filter((ev) => !ev.isRest)

      // 1. 同一小節内で表示ピッチが一致するものを最優先で探す
      let bestEvent =
        activeEventsInMeasure.find((ev) => ev.displayPitch === osmdPitchStr) ||
        null

      let minTimeDiff = Infinity

      // 2. 見つからない場合、同小節内で最も近い時間のイベントを探す
      if (!bestEvent && activeEventsInMeasure.length > 0) {
        for (const ev of activeEventsInMeasure) {
          const diff = Math.abs(ev.time - timeInTicks)
          if (diff < minTimeDiff) {
            minTimeDiff = diff
            bestEvent = ev
          }
        }
        // } else if (bestEvent) {
        //   minTimeDiff = Math.abs(bestEvent.time - timeInTicks)
      }

      let instrumentName = 'piano'
      try {
        if (sourceNote.ParentStaff?.ParentInstrument?.Name) {
          instrumentName = sourceNote.ParentStaff.ParentInstrument.Name
        }
      } catch {
        console.warn('Could not extract instrument name, defaulting to piano.')
      }

      const samplerId = bestEvent
        ? bestEvent.samplerId
        : instrumentName.toLowerCase().includes('drum')
          ? 'drum'
          : 'piano'
      const playbackKey = bestEvent ? bestEvent.playbackKey : osmdPitchStr
      const durationBeats = bestEvent
        ? bestEvent.duration / 192
        : sourceNote.Length.RealValue * 4

      // console.log('[NoteClick] Nearest note found:', {
      //   instrumentName,
      //   playbackKey,
      //   durationBeats,
      //   matchedEvent: bestEvent,
      //   minTimeDiff,
      // })

      if (playNote) {
        playNote(samplerId, playbackKey, durationBeats)
      }
    },
    [containerRef, osmdRef, playNote, parsedEvents]
  )

  return { handleScoreClick }
}
