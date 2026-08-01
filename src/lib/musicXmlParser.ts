import {
  DRUM_SAMPLE_KEY_BY_LABEL,
  MIDI_UNPITCHED_TO_KEY,
} from '../constants/drum'

export type SamplerId = 'piano' | 'drum' | 'clap'

export type NoteEvent = {
  partId: string
  partName: string | null
  instrumentName: string | null
  samplerId: SamplerId
  time: number
  duration: number
  note: string
  playbackKey: string
  midi: number
  lyric: string | null
  voice: string
  measureNumber: number
  isRest: boolean
  isTieContinuation: boolean
  isStaccato: boolean
  displayPitch: string | null
}

type PartMeta = {
  partName: string | null
  instrumentNameById: Map<string, string>
  midiUnpitchedById: Map<string, number>
}

type PendingTie = {
  partId: string
  partName: string | null
  instrumentName: string | null
  samplerId: SamplerId
  voice: string
  note: string
  playbackKey: string
  midi: number
  lyric: string | null
  startTime: number
  duration: number
  measureNumber: number
  startEvent: NoteEvent
  displayPitch: string | null
}

type ParsedNoteData = {
  note: string
  playbackKey: string
  midi: number
  samplerId: SamplerId
  instrumentName: string | null
  displayPitch: string | null
}

const TICKS_PER_QUARTER = 192

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

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

const normalizeLabel = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '')

const CLAP_LABELS = ['clap', 'handclap']
const DRUM_LABELS = [
  'drum',
  'percussion',
  'bassdrum',
  'sidestick',
  'snare',
  'hihat',
  'tom',
  'cymbal',
  'cowbell',
  'tambourine',
  'ridebell',
  'stick',
]

const getTempo = (doc: Document): number => {
  const soundTempo = doc.querySelector('sound[tempo]')
  if (soundTempo) {
    const tempo = Number(soundTempo.getAttribute('tempo'))
    if (!Number.isNaN(tempo) && tempo > 0) return tempo
  }

  const metronome = doc.querySelector('metronome per-minute')
  if (metronome?.textContent) {
    const tempo = Number(metronome.textContent)
    if (!Number.isNaN(tempo) && tempo > 0) return tempo
  }

  return 120
}

const getPartMetaMap = (doc: Document): Map<string, PartMeta> => {
  const partMetaMap = new Map<string, PartMeta>()

  doc.querySelectorAll('part-list > score-part').forEach((scorePart) => {
    const partId = scorePart.getAttribute('id')
    if (!partId) return

    const partName =
      scorePart.querySelector('part-name')?.textContent?.trim() || null
    const instrumentNameById = new Map<string, string>()
    const midiUnpitchedById = new Map<string, number>()

    scorePart
      .querySelectorAll('score-instrument')
      .forEach((scoreInstrument) => {
        const instrumentId = scoreInstrument.getAttribute('id')
        const instrumentName = scoreInstrument
          .querySelector('instrument-name')
          ?.textContent?.trim()

        if (instrumentId && instrumentName) {
          instrumentNameById.set(instrumentId, instrumentName)
        }
      })

    scorePart.querySelectorAll('midi-instrument').forEach((midiInstrument) => {
      const instrumentId = midiInstrument.getAttribute('id')
      // MusicXML の midi-unpitched は 1-indexed (1-128) なので、
      // 標準 MIDI note number (0-127) に変換するために -1 する
      const rawValue = Number(
        midiInstrument.querySelector('midi-unpitched')?.textContent || ''
      )
      const midiUnpitched = rawValue - 1

      if (instrumentId && !Number.isNaN(midiUnpitched) && midiUnpitched >= 0) {
        midiUnpitchedById.set(instrumentId, midiUnpitched)
      }
    })

    partMetaMap.set(partId, {
      partName,
      instrumentNameById,
      midiUnpitchedById,
    })
  })

  return partMetaMap
}

const getInitialDivisions = (doc: Document): number => {
  const divisions = Number(
    doc.querySelector('part measure attributes divisions')?.textContent || '1'
  )

  return Number.isNaN(divisions) || divisions <= 0 ? 1 : divisions
}

const getMeasureDivisions = (measure: Element, fallback: number): number => {
  const text = measure.querySelector('attributes > divisions')?.textContent
  const value = Number(text)

  return !text || Number.isNaN(value) || value <= 0 ? fallback : value
}

const getVoice = (note: Element): string =>
  note.querySelector('voice')?.textContent?.trim() || '1'

const getLyric = (note: Element): string | null => {
  const lyric = note.querySelector('lyric text')?.textContent?.trim()
  return lyric && lyric.length > 0 ? lyric : null
}

const getDurationTicks = (note: Element, divisions: number): number => {
  const duration = Number(note.querySelector('duration')?.textContent || '0')
  if (Number.isNaN(duration) || duration <= 0) return 0

  return Math.round((duration / divisions) * TICKS_PER_QUARTER)
}

const hasTieStart = (note: Element): boolean =>
  note.querySelector(
    ':scope > tie[type="start"], :scope > notations > tied[type="start"]'
  ) !== null

const hasTieStop = (note: Element): boolean =>
  note.querySelector(
    ':scope > tie[type="stop"], :scope > notations > tied[type="stop"]'
  ) !== null

const hasStaccato = (note: Element): boolean =>
  note.querySelector(':scope > notations > articulations > staccato') !== null

const getInstrumentId = (note: Element): string | null =>
  note.querySelector('instrument')?.getAttribute('id') || null

const isClapLabel = (label: string | null): boolean => {
  if (!label) return false
  const normalized = normalizeLabel(label)
  return CLAP_LABELS.some((candidate) => normalized.includes(candidate))
}

const isDrumLabel = (label: string | null): boolean => {
  if (!label) return false
  const normalized = normalizeLabel(label)
  return DRUM_LABELS.some((candidate) => normalized.includes(candidate))
}

const resolveSamplerId = (
  partMeta: PartMeta,
  instrumentName: string | null
): SamplerId => {
  const labels = [
    partMeta.partName,
    instrumentName,
    ...partMeta.instrumentNameById.values(),
  ]

  if (labels.some(isClapLabel)) return 'clap'
  if (labels.some(isDrumLabel)) return 'drum'

  return 'piano'
}

const resolvePercussionPlaybackKey = (
  instrumentName: string | null,
  samplerId: SamplerId,
  midi: number
): string => {
  if (samplerId === 'clap') return 'C4'

  if (midi && MIDI_UNPITCHED_TO_KEY[midi]) return MIDI_UNPITCHED_TO_KEY[midi]

  const normalized = normalizeLabel(instrumentName || '')
  return DRUM_SAMPLE_KEY_BY_LABEL[normalized] || 'C1'
}

const parsePitchNote = (note: Element): ParsedNoteData => {
  const step = note.querySelector('pitch > step')?.textContent?.trim() || 'C'
  const alter = Number(note.querySelector('pitch > alter')?.textContent || '0')
  const octave = Number(
    note.querySelector('pitch > octave')?.textContent || '4'
  )

  const safeAlter = Number.isNaN(alter) ? 0 : alter
  const safeOctave = Number.isNaN(octave) ? 4 : octave
  const semitone = (STEP_TO_SEMITONE[step] ?? 0) + safeAlter
  const octaveShift = Math.floor(semitone / 12)
  const normalizedSemitone = ((semitone % 12) + 12) % 12
  const finalOctave = safeOctave + octaveShift
  const noteName = `${SEMITONE_TO_NOTE[normalizedSemitone]}${finalOctave}`

  return {
    note: noteName,
    playbackKey: noteName,
    midi: finalOctave * 12 + normalizedSemitone,
    samplerId: 'piano',
    instrumentName: null,
    displayPitch: noteName,
  }
}

const parseUnpitchedDisplayPitch = (note: Element): string => {
  const step =
    note.querySelector('unpitched > display-step')?.textContent?.trim() || 'C'
  const octave = Number(
    note.querySelector('unpitched > display-octave')?.textContent || '4'
  )
  const alter = Number(
    note.querySelector('unpitched > display-alter')?.textContent || '0'
  )

  const safeAlter = Number.isNaN(alter) ? 0 : alter
  const safeOctave = Number.isNaN(octave) ? 4 : octave
  const semitone = (STEP_TO_SEMITONE[step] ?? 0) + safeAlter
  const octaveShift = Math.floor(semitone / 12)
  const normalizedSemitone = ((semitone % 12) + 12) % 12
  const finalOctave = safeOctave + octaveShift
  return `${SEMITONE_TO_NOTE[normalizedSemitone]}${finalOctave}`
}

const parseUnpitchedNote = (
  note: Element,
  partMeta: PartMeta,
  instrumentName: string | null,
  samplerId: SamplerId,
  instrumentId: string | null
): ParsedNoteData => {
  const noteLabel = instrumentName || partMeta.partName || 'Percussion'
  const midi = instrumentId
    ? (partMeta.midiUnpitchedById.get(instrumentId) ?? 0)
    : 0

  return {
    note: noteLabel,
    playbackKey: resolvePercussionPlaybackKey(instrumentName, samplerId, midi),
    midi,
    samplerId,
    instrumentName: instrumentName || noteLabel,
    displayPitch: parseUnpitchedDisplayPitch(note),
  }
}

const parseNoteData = (
  note: Element,
  partMeta: PartMeta,
  partId: string
): ParsedNoteData | null => {
  const instrumentId = getInstrumentId(note)
  const instrumentName = instrumentId
    ? partMeta.instrumentNameById.get(instrumentId) || null
    : null
  const samplerId = resolveSamplerId(partMeta, instrumentName)

  if (note.querySelector('unpitched')) {
    return parseUnpitchedNote(
      note,
      partMeta,
      instrumentName,
      samplerId,
      instrumentId
    )
  }

  if (note.querySelector('pitch')) {
    return parsePitchNote(note)
  }

  if (instrumentName || partMeta.partName) {
    return {
      note: instrumentName || partMeta.partName || partId,
      playbackKey: samplerId === 'clap' ? 'C4' : 'C1',
      midi: 0,
      samplerId,
      instrumentName: instrumentName || partMeta.partName,
      displayPitch: samplerId === 'clap' ? 'C4' : 'C1',
    }
  }

  return null
}

export const parseMusicXmlForEvents = async (
  musicXml: string
): Promise<NoteEvent[]> => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(musicXml, 'application/xml')

  if (doc.querySelector('parsererror')) {
    console.warn('MusicXML の解析に失敗しました')
    return []
  }

  const Tone = await import('tone')
  const tempo = getTempo(doc)
  Tone.getTransport().bpm.value = tempo

  const events: NoteEvent[] = []
  const fallbackDivisions = getInitialDivisions(doc)
  const partMetaMap = getPartMetaMap(doc)

  // 各小節の絶対開始ティック数を事前に算出する
  const measureStartTicks: number[] = []
  const firstPart = doc.querySelector('part')
  if (firstPart) {
    let currentBeats = 4
    let currentBeatType = 4
    let accumulatedTicks = 0

    firstPart.querySelectorAll('measure').forEach((measure, measureIndex) => {
      const timeElem = measure.querySelector('attributes > time')
      if (timeElem) {
        const beatsVal = Number(timeElem.querySelector('beats')?.textContent)
        const beatTypeVal = Number(
          timeElem.querySelector('beat-type')?.textContent
        )
        if (!Number.isNaN(beatsVal) && beatsVal > 0) {
          currentBeats = beatsVal
        }
        if (!Number.isNaN(beatTypeVal) && beatTypeVal > 0) {
          currentBeatType = beatTypeVal
        }
      }

      measureStartTicks[measureIndex] = accumulatedTicks

      let measureLengthTicks = Math.round(
        ((currentBeats * 4) / currentBeatType) * TICKS_PER_QUARTER
      )

      // 最初の小節がアウフタクト（不完全小節）であるかどうかのチェック
      if (measureIndex === 0) {
        let maxFirstMeasureTicks = 0
        doc.querySelectorAll('part').forEach((p) => {
          const firstMeas = p.querySelector('measure')
          if (firstMeas) {
            const divText = firstMeas.querySelector(
              'attributes > divisions'
            )?.textContent
            const div = divText ? Number(divText) : fallbackDivisions
            const safeDiv =
              !div || Number.isNaN(div) || div <= 0 ? fallbackDivisions : div

            const vTicks = new Map<string, number>()
            let cursor = 0
            Array.from(firstMeas.children).forEach((child) => {
              const tag = child.tagName.toLowerCase()
              if (tag === 'backup') {
                const backDur = Number(
                  child.querySelector('duration')?.textContent || '0'
                )
                const backTicks = Number.isNaN(backDur)
                  ? 0
                  : Math.round((backDur / safeDiv) * TICKS_PER_QUARTER)
                cursor = Math.max(0, cursor - backTicks)
              } else if (tag === 'forward') {
                const fwdDur = Number(
                  child.querySelector('duration')?.textContent || '0'
                )
                const fwdTicks = Number.isNaN(fwdDur)
                  ? 0
                  : Math.round((fwdDur / safeDiv) * TICKS_PER_QUARTER)
                cursor += fwdTicks
              } else if (tag === 'note') {
                const voice = getVoice(child)
                const duration = getDurationTicks(child, safeDiv)
                const isChord = child.querySelector('chord') !== null
                const startTime = isChord ? (vTicks.get(voice) ?? 0) : cursor
                const endTime = startTime + duration
                if (!isChord) {
                  vTicks.set(voice, endTime)
                  cursor = endTime
                }
              }
            })
            const firstPartMax = Array.from(vTicks.values()).reduce(
              (a, b) => Math.max(a, b),
              0
            )
            if (firstPartMax > maxFirstMeasureTicks) {
              maxFirstMeasureTicks = firstPartMax
            }
          }
        })

        if (
          maxFirstMeasureTicks > 0 &&
          maxFirstMeasureTicks < measureLengthTicks
        ) {
          measureLengthTicks = maxFirstMeasureTicks
        }
      }

      accumulatedTicks += measureLengthTicks
    })
  }

  doc.querySelectorAll('part').forEach((part) => {
    const partId = part.getAttribute('id') || 'P1'
    const partMeta = partMetaMap.get(partId) || {
      partName: null,
      instrumentNameById: new Map<string, string>(),
      midiUnpitchedById: new Map<string, number>(),
    }
    const voiceTicks = new Map<string, number>()
    const pendingTies = new Map<string, PendingTie>()
    let currentDivisions = fallbackDivisions

    part.querySelectorAll('measure').forEach((measure, measureIndex) => {
      currentDivisions = getMeasureDivisions(measure, currentDivisions)

      const startTicks = measureStartTicks[measureIndex] ?? 0
      let measureCursor = startTicks

      // measureChildren の処理
      Array.from(measure.children).forEach((child) => {
        const tag = child.tagName.toLowerCase()

        if (tag === 'backup') {
          const backDur = Number(
            child.querySelector('duration')?.textContent || '0'
          )
          const backTicks = Number.isNaN(backDur)
            ? 0
            : Math.round((backDur / currentDivisions) * TICKS_PER_QUARTER)
          measureCursor = Math.max(startTicks, measureCursor - backTicks)
          return
        }

        if (tag === 'forward') {
          const fwdDur = Number(
            child.querySelector('duration')?.textContent || '0'
          )
          const fwdTicks = Number.isNaN(fwdDur)
            ? 0
            : Math.round((fwdDur / currentDivisions) * TICKS_PER_QUARTER)
          measureCursor += fwdTicks
          return
        }

        if (tag !== 'note') return

        const note = child as Element
        const voice = getVoice(note)
        const duration = getDurationTicks(note, currentDivisions)
        const isChord = note.querySelector('chord') !== null
        const isRest = note.querySelector('rest') !== null
        const isStaccato = hasStaccato(note)

        const currentTime = voiceTicks.get(voice) ?? startTicks
        const baseTime = Math.max(currentTime, startTicks)
        const startTime = isChord ? baseTime : measureCursor

        const rawNum = measure.getAttribute('number')
        const measureNumber = rawNum ? parseInt(rawNum, 10) : measureIndex + 1

        if (isRest) {
          events.push({
            partId,
            partName: partMeta.partName,
            instrumentName: null,
            samplerId: 'piano',
            time: startTime,
            duration,
            note: 'rest',
            playbackKey: '',
            midi: 0,
            lyric: null,
            voice,
            measureNumber,
            isRest: true,
            isTieContinuation: false,
            isStaccato: false,
            displayPitch: null,
          })
          if (!isChord) {
            voiceTicks.set(voice, startTime + duration)
            measureCursor = startTime + duration
          }
          return
        }

        const parsedNote = parseNoteData(note, partMeta, partId)
        if (!parsedNote) {
          if (!isChord) {
            voiceTicks.set(voice, startTime + duration)
            measureCursor = startTime + duration
          }
          return
        }

        const lyric = getLyric(note)
        const tieKey = `${voice}:${parsedNote.playbackKey}`
        const tieStart = hasTieStart(note)
        const tieStop = hasTieStop(note)
        const pendingTie = pendingTies.get(tieKey)

        if (tieStop && pendingTie) {
          pendingTie.duration += duration
          pendingTie.lyric = pendingTie.lyric ?? lyric

          events.push({
            partId: pendingTie.partId,
            partName: pendingTie.partName,
            instrumentName: pendingTie.instrumentName,
            samplerId: pendingTie.samplerId,
            time: startTime,
            duration,
            note: pendingTie.note,
            playbackKey: pendingTie.playbackKey,
            midi: pendingTie.midi,
            lyric: pendingTie.lyric,
            voice: pendingTie.voice,
            measureNumber,
            isRest: false,
            isTieContinuation: true,
            isStaccato,
            displayPitch: pendingTie.displayPitch,
          })

          if (!tieStart) {
            pendingTie.startEvent.duration = pendingTie.duration
            pendingTie.startEvent.lyric =
              pendingTie.startEvent.lyric ?? pendingTie.lyric
            pendingTies.delete(tieKey)
          }

          if (!isChord) {
            voiceTicks.set(voice, startTime + duration)
            measureCursor = startTime + duration
          }
          return
        }

        if (tieStart && !tieStop) {
          const event: NoteEvent = {
            partId,
            partName: partMeta.partName,
            instrumentName: parsedNote.instrumentName,
            samplerId: parsedNote.samplerId,
            time: startTime,
            duration,
            note: parsedNote.note,
            playbackKey: parsedNote.playbackKey,
            midi: parsedNote.midi,
            lyric,
            voice,
            measureNumber,
            isRest: false,
            isTieContinuation: false,
            isStaccato,
            displayPitch: parsedNote.displayPitch,
          }
          events.push(event)

          pendingTies.set(tieKey, {
            partId,
            partName: partMeta.partName,
            instrumentName: parsedNote.instrumentName,
            samplerId: parsedNote.samplerId,
            voice,
            note: parsedNote.note,
            playbackKey: parsedNote.playbackKey,
            midi: parsedNote.midi,
            lyric,
            startTime,
            duration,
            measureNumber: measureIndex + 1,
            startEvent: event,
            displayPitch: parsedNote.displayPitch,
          })

          if (!isChord) {
            voiceTicks.set(voice, startTime + duration)
            measureCursor = startTime + duration
          }
          return
        }

        if (tieStart && tieStop) {
          const event: NoteEvent = {
            partId,
            partName: partMeta.partName,
            instrumentName: parsedNote.instrumentName,
            samplerId: parsedNote.samplerId,
            time: startTime,
            duration,
            note: parsedNote.note,
            playbackKey: parsedNote.playbackKey,
            midi: parsedNote.midi,
            lyric,
            voice,
            measureNumber,
            isRest: false,
            isTieContinuation: false,
            isStaccato,
            displayPitch: parsedNote.displayPitch,
          }
          events.push(event)

          pendingTies.set(tieKey, {
            partId,
            partName: partMeta.partName,
            instrumentName: parsedNote.instrumentName,
            samplerId: parsedNote.samplerId,
            voice,
            note: parsedNote.note,
            playbackKey: parsedNote.playbackKey,
            midi: parsedNote.midi,
            lyric,
            startTime,
            duration,
            measureNumber: measureIndex + 1,
            startEvent: event,
            displayPitch: parsedNote.displayPitch,
          })

          if (!isChord) {
            voiceTicks.set(voice, startTime + duration)
            measureCursor = startTime + duration
          }
          return
        }

        events.push({
          partId,
          partName: partMeta.partName,
          instrumentName: parsedNote.instrumentName,
          samplerId: parsedNote.samplerId,
          time: startTime,
          duration,
          note: parsedNote.note,
          playbackKey: parsedNote.playbackKey,
          midi: parsedNote.midi,
          lyric,
          voice,
          measureNumber,
          isRest: false,
          isTieContinuation: false,
          isStaccato,
          displayPitch: parsedNote.displayPitch,
        })

        if (!isChord) {
          voiceTicks.set(voice, startTime + duration)
          measureCursor = startTime + duration
        }
      })
    })

    pendingTies.forEach((pendingTie) => {
      pendingTie.startEvent.duration = pendingTie.duration
      pendingTie.startEvent.lyric =
        pendingTie.startEvent.lyric ?? pendingTie.lyric
    })
  })

  return events.sort(
    (left, right) =>
      left.time - right.time ||
      left.partId.localeCompare(right.partId) ||
      left.voice.localeCompare(right.voice)
  )
}
