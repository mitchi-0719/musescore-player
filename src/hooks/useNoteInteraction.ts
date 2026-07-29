import { type RefObject, useCallback, useMemo, useRef } from 'react'

import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

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

// タップ判定の閾値
const TAP_MAX_DURATION_MS = 300
const TAP_MAX_DISTANCE_PX = 10

// 2分音符をデフォルトの音符の長さとする
const DEFAULT_DURATION_BEATS = 2

type PointerDownState = {
  pointerId: number
  clientX: number
  clientY: number
  timestamp: number
}

const getSvgElement = (note: object): SVGElement | null => {
  if ('getSVGGElement' in note && typeof note.getSVGGElement === 'function') {
    return note.getSVGGElement() as SVGElement | null
  }
  return null
}

const clearNoteHighlight = (note: object) => {
  const svgElement = getSvgElement(note)
  if (svgElement) {
    svgElement.classList.remove('note-highlight')
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
    svgElement.classList.add('note-highlight')
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
  const pointerDownRef = useRef<PointerDownState | null>(null)
  const setHighlightedNote = useScoreStore((state) => state.setHighlightedNote)

  // SVG要素のキャッシュ（毎回querySelector を回避）
  const svgCacheRef = useRef<SVGElement | null>(null)
  // BoundingClientRect のキャッシュ（pointerdown 時に取得して pointerup で再利用）
  const svgRectCacheRef = useRef<DOMRect | null>(null)

  // 小節番号で音符イベントをグループ化するインデックスを作成
  const measureEventMap = useMemo(() => {
    const map = new Map<number, NoteEvent[]>()
    for (const ev of parsedEvents) {
      if (!map.has(ev.measureNumber)) {
        map.set(ev.measureNumber, [])
      }
      map.get(ev.measureNumber)!.push(ev)
    }
    return map
  }, [parsedEvents])

  // ノート検索と再生のコアロジック（pointerup から呼ばれる）
  const processNoteClick = useCallback(
    async (clientX: number, clientY: number) => {
      if (!containerRef.current || !osmdRef.current) return

      const osmd = osmdRef.current

      // SVG要素をキャッシュから取得（無ければ検索してキャッシュ）
      let svg = svgCacheRef.current
      if (!svg || !svg.isConnected) {
        svg = containerRef.current.querySelector('svg')
        svgCacheRef.current = svg
      }
      if (!svg) return

      // BoundingRect はキャッシュを優先利用（pointerdown 時に取得済み）
      const svgRect = svgRectCacheRef.current ?? svg.getBoundingClientRect()

      const osmdX = (clientX - svgRect.left) / (10 * osmd.zoom)
      const osmdY = (clientY - svgRect.top) / (10 * osmd.zoom)

      const { PointF2D } = await import('opensheetmusicdisplay')
      if (osmdRef.current !== osmd) return

      const clickPoint = new PointF2D(osmdX, osmdY)
      const maxDistance = new PointF2D(3, 3)

      const graphicalNote = osmd.GraphicSheet.GetNearestNote(
        clickPoint,
        maxDistance
      )

      if (!graphicalNote) {
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

      const timeInTicks = Math.round(
        sourceNote.getAbsoluteTimestamp().RealValue * 4 * 192
      )

      if (sourceNote.isRest()) {
        setHighlightedNote(timeInTicks)
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

      // 小節番号インデックスから対象小節 of イベントリストを取得
      const eventsInMeasureTotal = measureEventMap.get(measureNum) || []

      // 声部(Voice)も一致するイベントを優先してフィルタリング
      let eventsInMeasure = eventsInMeasureTotal.filter(
        (ev) =>
          (!partId || ev.partId === partId) &&
          (!voiceId || ev.voice === voiceId)
      )

      // 声部フィルタで候補が空になった場合は、声部フィルタなしでフォールバック
      if (eventsInMeasure.length === 0) {
        eventsInMeasure = eventsInMeasureTotal.filter(
          (ev) => !partId || ev.partId === partId
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
      const selectedNoteTime = bestEvent ? bestEvent.time : timeInTicks

      setHighlightedNote(selectedNoteTime)

      if (playNote) {
        playNote(samplerId, playbackKey, DEFAULT_DURATION_BEATS)
      }
    },
    [containerRef, osmdRef, playNote, measureEventMap, setHighlightedNote]
  )

  // Phase 1: pointerdown — 座標・タイムスタンプを記録（BoundingRect もここでキャッシュ）
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Phase 3: 再生中はタップ記録自体を行わない
      if (useScoreStore.getState().isPlaying) return

      pointerDownRef.current = {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        timestamp: performance.now(),
      }

      // BoundingRect を pointerdown 時点でキャッシュ（レイアウト再計算は1回だけ）
      let svg = svgCacheRef.current
      if (!svg || !svg.isConnected) {
        svg = containerRef.current?.querySelector('svg') ?? null
        svgCacheRef.current = svg
      }
      if (svg) {
        svgRectCacheRef.current = svg.getBoundingClientRect()
      }
    },
    [containerRef]
  )

  // Phase 1: pointerup — タップ判定を行い、条件を満たした場合のみノート処理を実行
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const downState = pointerDownRef.current
      pointerDownRef.current = null

      if (!downState) return

      // 同一ポインターか確認
      if (e.pointerId !== downState.pointerId) return

      // Phase 3: 再生中ガード（pointerdown 後に再生が開始された場合のフォールバック）
      if (useScoreStore.getState().isPlaying) return

      const elapsed = performance.now() - downState.timestamp
      const dx = e.clientX - downState.clientX
      const dy = e.clientY - downState.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // タップ判定: 時間が短く、移動距離が小さい場合のみ有効なタップとして処理
      if (elapsed > TAP_MAX_DURATION_MS || distance > TAP_MAX_DISTANCE_PX) {
        return
      }

      // pointerdown 時の座標を使ってノートを検索・再生
      void processNoteClick(downState.clientX, downState.clientY).catch(
        (error: unknown) => {
          console.error('Note interaction failed:', error)
        }
      )
    },
    [processNoteClick]
  )

  return { handlePointerDown, handlePointerUp }
}
