import type {
  BoundingBox,
  GraphicalMeasure,
  OpenSheetMusicDisplay,
} from 'opensheetmusicdisplay'

const TICKS_PER_QUARTER = 192
const OSMD_TIMESTAMP_TO_TICKS = 4 * TICKS_PER_QUARTER

export type PlaybackCursorAnchor = {
  ticks: number
  measureIndex: number
  x: number
  y: number
  height: number
  measurePositionAndShape: BoundingBox
}

const createAnchor = (
  measureIndex: number,
  measure: GraphicalMeasure,
  ticks: number,
  x: number
): PlaybackCursorAnchor | null => {
  const musicSystem = measure.ParentMusicSystem
  const firstStaffLine = musicSystem?.StaffLines[0]
  const lastStaffLine =
    musicSystem?.StaffLines[musicSystem.StaffLines.length - 1]
  if (!musicSystem || !firstStaffLine || !lastStaffLine) return null

  const systemY = musicSystem.PositionAndShape.AbsolutePosition.y
  const y = systemY + firstStaffLine.PositionAndShape.RelativePosition.y
  const endY =
    systemY +
    lastStaffLine.PositionAndShape.RelativePosition.y +
    lastStaffLine.StaffHeight

  return {
    ticks,
    measureIndex,
    x,
    y,
    height: endY - y,
    measurePositionAndShape: measure.PositionAndShape,
  }
}

/**
 * Builds a sorted index of the score positions at which the playback cursor can
 * be displayed. Multiple notes and staves at the same timestamp share one
 * anchor, matching OSMD's single vertical playback cursor.
 */
export const buildPlaybackCursorIndex = (
  osmd: OpenSheetMusicDisplay
): PlaybackCursorAnchor[] => {
  const anchorByTicks = new Map<number, PlaybackCursorAnchor>()
  const measureList = osmd.GraphicSheet?.MeasureList
  if (!measureList) return []

  measureList.forEach((measures, measureIndex) => {
    measures?.forEach((measure) => {
      if (!measure?.isVisible()) return

      measure.staffEntries.forEach((staffEntry) => {
        if (!staffEntry?.graphicalVoiceEntries.length) return

        const ticks = Math.round(
          staffEntry.getAbsoluteTimestamp().RealValue * OSMD_TIMESTAMP_TO_TICKS
        )
        const x = staffEntry.PositionAndShape.AbsolutePosition.x
        const existingAnchor = anchorByTicks.get(ticks)

        // At a shared timestamp OSMD positions its cursor at the left-most
        // visible staff entry.
        if (existingAnchor && existingAnchor.x <= x) return

        const anchor = createAnchor(measureIndex, measure, ticks, x)
        if (anchor) anchorByTicks.set(ticks, anchor)
      })
    })
  })

  return Array.from(anchorByTicks.values()).sort(
    (left, right) => left.ticks - right.ticks
  )
}

/** Finds the closest cursor anchor in O(log n). Ties prefer the earlier note. */
export const findNearestPlaybackCursorAnchor = (
  anchors: PlaybackCursorAnchor[],
  targetTicks: number
): PlaybackCursorAnchor | null => {
  if (anchors.length === 0) return null
  if (targetTicks <= anchors[0].ticks) return anchors[0]

  const lastAnchor = anchors[anchors.length - 1]
  if (targetTicks >= lastAnchor.ticks) return lastAnchor

  let low = 0
  let high = anchors.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const anchor = anchors[middle]
    if (anchor.ticks === targetTicks) return anchor
    if (anchor.ticks < targetTicks) low = middle + 1
    else high = middle - 1
  }

  const before = anchors[high]
  const after = anchors[low]
  return targetTicks - before.ticks <= after.ticks - targetTicks
    ? before
    : after
}
