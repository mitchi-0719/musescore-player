/**
 * Audio Synchronization Helper
 * 再生時刻から楽譜上の小節・ノート情報をマッピングする機能を提供
 */
import type { MeasureMetadata, NoteMetadata } from '../stores/useScoreStore'

/**
 * MusicXML を解析して小節とノートのメタデータを抽出
 */
export function extractMeasuresAndNotes(
  musicXml: string,
  baseTempo: number = 120
): {
  measures: MeasureMetadata[]
  notes: NoteMetadata[]
  totalDuration: number
} {
  try {
    const doc = new DOMParser().parseFromString(musicXml, 'application/xml')

    // パース中のエラーをチェック
    if (doc.documentElement.tagName === 'parsererror') {
      throw new Error('Invalid MusicXML format')
    }

    const divisionsEl = doc.querySelector('divisions')
    const divisions = divisionsEl ? Number(divisionsEl.textContent || '1') : 1

    // テンポを取得
    let tempo = baseTempo
    const sound = doc.querySelector('sound[tempo]')
    if (sound) {
      const t = Number(sound.getAttribute('tempo'))
      if (!isNaN(t) && t > 0) tempo = t
    } else {
      const metronome = doc.querySelector(
        'sound properties metronome per-minute'
      )
      if (metronome?.textContent) {
        const t = Number(metronome.textContent)
        if (!isNaN(t) && t > 0) tempo = t
      }
    }

    const measures: MeasureMetadata[] = []
    const notes: NoteMetadata[] = []
    let globalTime = 0

    const part = doc.querySelector('part')
    if (!part) {
      return { measures: [], notes: [], totalDuration: 0 }
    }

    const measureElements = Array.from(part.querySelectorAll('measure'))

    for (
      let measureIdx = 0;
      measureIdx < measureElements.length;
      measureIdx++
    ) {
      const measure = measureElements[measureIdx]
      const measureNumber = measureIdx + 1

      const measureStartTime = globalTime
      let measureDuration = 0
      const noteIndicesInMeasure: number[] = []

      const noteElements = Array.from(measure.querySelectorAll('note'))

      for (const note of noteElements) {
        const isRest = !!note.querySelector('rest')
        const durationEl = note.querySelector('duration')
        const durationDiv = durationEl
          ? Number(durationEl.textContent || '0')
          : 0

        // ノート情報を抽出
        if (!isRest) {
          const step = note.querySelector('pitch > step')?.textContent || 'C'
          const alter = Number(
            note.querySelector('pitch > alter')?.textContent || '0'
          )
          const octave = Number(
            note.querySelector('pitch > octave')?.textContent || '4'
          )

          const stepMap: Record<string, number> = {
            C: 0,
            D: 2,
            E: 4,
            F: 5,
            G: 7,
            A: 9,
            B: 11,
          }

          const semitone =
            (stepMap[step.toUpperCase()] ?? 0) + (isNaN(alter) ? 0 : alter)
          const midi = (octave + 1) * 12 + semitone
          const durSec =
            divisions > 0 ? (durationDiv / divisions) * (60 / tempo) : 0

          notes.push({
            time: globalTime,
            duration: durSec,
            midi,
            measureNumber,
          })

          noteIndicesInMeasure.push(notes.length - 1)
        }

        // Chord 処理: <chord/> がある場合は時間を進めない
        const isChord = !!note.querySelector('chord')
        if (!isChord) {
          const advance =
            divisions > 0 ? (durationDiv / divisions) * (60 / tempo) : 0
          measureDuration += advance
          globalTime += advance
        }
      }

      // 小節情報を記録
      measures.push({
        number: measureNumber,
        startTime: measureStartTime,
        endTime: measureStartTime + measureDuration,
        duration: measureDuration,
      })
    }

    return {
      measures,
      notes,
      totalDuration: globalTime,
    }
  } catch (error) {
    console.error('Error extracting measures and notes:', error)
    return { measures: [], notes: [], totalDuration: 0 }
  }
}

/**
 * 現在の再生時刻から対応する小節番号を取得
 */
export function getMeasureAtTime(
  time: number,
  measures: MeasureMetadata[]
): number | null {
  if (!measures.length) return null

  for (const measure of measures) {
    if (time >= measure.startTime && time < measure.endTime) {
      return measure.number
    }
  }

  // 最後の小節の終了時刻ちょうどの場合
  const lastMeasure = measures[measures.length - 1]
  if (time >= lastMeasure.endTime && time <= lastMeasure.endTime + 0.1) {
    return lastMeasure.number
  }

  return null
}

/**
 * 現在の再生時刻から対応するノートを取得
 * @param time 再生時刻（秒）
 * @param notes ノートリスト
 * @param tolerance 許容誤差（秒）
 * @returns マッチしたノート、またはnull
 */
export function getNoteAtTime(
  time: number,
  notes: NoteMetadata[],
  tolerance: number = 0.05
): NoteMetadata | null {
  if (!notes.length) return null

  // 最も近いノートを探す
  let closestNote: NoteMetadata | null = null
  let minDistance = tolerance

  for (const note of notes) {
    const distance = Math.abs(note.time - time)
    if (distance < minDistance) {
      closestNote = note
      minDistance = distance
    }
  }

  return closestNote
}

/**
 * 小節番号から小節情報を取得
 */
export function getMeasureByNumber(
  measureNumber: number,
  measures: MeasureMetadata[]
): MeasureMetadata | null {
  return measures.find((m) => m.number === measureNumber) || null
}

/**
 * 小節開始時刻にシーク
 */
export function getSeekTimeForMeasure(
  measureNumber: number,
  measures: MeasureMetadata[]
): number | null {
  const measure = getMeasureByNumber(measureNumber, measures)
  return measure ? measure.startTime : null
}

/**
 * MusicXML の harmony 要素に表示用のコードラベル (text属性) を付与する
 */
export function injectHarmonyText(musicXml: string): string {
  try {
    const doc = new DOMParser().parseFromString(musicXml, 'application/xml')
    const harmonies = Array.from(doc.getElementsByTagName('harmony'))

    harmonies.forEach((harmony) => {
      const kind = harmony.getElementsByTagName('kind')[0]
      if (!kind) return

      const rawKindLabel =
        kind.getAttribute('text')?.trim() || kind.textContent?.trim() || ''
      const kindLabel =
        rawKindLabel &&
        !['none', 'major', 'maj'].includes(rawKindLabel.toLowerCase())
          ? rawKindLabel
          : ''

      const rootStep = harmony
        .getElementsByTagName('root-step')[0]
        ?.textContent?.trim()
      if (!rootStep) {
        kind.setAttribute('text', kindLabel || 'N.C.')
        return
      }

      const rootAlter = Number(
        harmony.getElementsByTagName('root-alter')[0]?.textContent || '0'
      )
      const bassStep = harmony
        .getElementsByTagName('bass-step')[0]
        ?.textContent?.trim()
      const bassAlter = Number(
        harmony.getElementsByTagName('bass-alter')[0]?.textContent || '0'
      )

      const accidental =
        rootAlter > 0
          ? '#'.repeat(rootAlter)
          : rootAlter < 0
            ? 'b'.repeat(Math.abs(rootAlter))
            : ''
      const bassAccidental =
        bassAlter > 0
          ? '#'.repeat(bassAlter)
          : bassAlter < 0
            ? 'b'.repeat(Math.abs(bassAlter))
            : ''

      const base = `${rootStep}${accidental}${kindLabel}`.trim()
      if (bassStep) {
        kind.setAttribute('text', `${base}/${bassStep}${bassAccidental}`)
      } else {
        kind.setAttribute('text', base || 'N.C.')
      }
    })

    return new XMLSerializer().serializeToString(doc)
  } catch (error) {
    console.warn('Failed to inject harmony text:', error)
    return musicXml
  }
}
