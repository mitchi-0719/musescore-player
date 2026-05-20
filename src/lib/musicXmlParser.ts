import * as Tone from 'tone'

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
}

type ParsedNoteData = {
  note: string
  playbackKey: string
  midi: number
  samplerId: SamplerId
  instrumentName: string | null
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
      const midiUnpitched = Number(
        midiInstrument.querySelector('midi-unpitched')?.textContent || ''
      )

      if (instrumentId && !Number.isNaN(midiUnpitched)) {
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
  }
}

const parseUnpitchedNote = (
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
    return parseUnpitchedNote(partMeta, instrumentName, samplerId, instrumentId)
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
    }
  }

  return null
}

export const parseMusicXmlForEvents = (musicXml: string): NoteEvent[] => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(musicXml, 'application/xml')

  if (doc.querySelector('parsererror')) {
    console.warn('MusicXML の解析に失敗しました')
    return []
  }

  const tempo = getTempo(doc)
  Tone.getTransport().bpm.value = tempo

  const events: NoteEvent[] = []
  const fallbackDivisions = getInitialDivisions(doc)
  const partMetaMap = getPartMetaMap(doc)

  console.log('[MusicXML] parse start', {
    tempo,
    partCount: doc.querySelectorAll('part').length,
  })

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

    console.log('[MusicXML] part detected', {
      partId,
      partName: partMeta.partName,
      instrumentNames: Array.from(partMeta.instrumentNameById.values()),
    })

    part.querySelectorAll('measure').forEach((measure, measureIndex) => {
      currentDivisions = getMeasureDivisions(measure, currentDivisions)

      // measureCursor follows the sequential position within this measure
      const existingVoiceTimes = Array.from(voiceTicks.values())
      let measureCursor =
        existingVoiceTimes.length > 0 ? Math.max(...existingVoiceTimes) : 0

      // process measure children in document order to respect <backup> / <forward>
      Array.from(measure.children).forEach((child) => {
        const tag = child.tagName.toLowerCase()

        if (tag === 'backup') {
          const backDur = Number(
            child.querySelector('duration')?.textContent || '0'
          )
          const backTicks = Number.isNaN(backDur)
            ? 0
            : Math.round((backDur / currentDivisions) * TICKS_PER_QUARTER)
          measureCursor = Math.max(0, measureCursor - backTicks)
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

        const currentTime = voiceTicks.get(voice) ?? 0
        const startTime = isChord ? currentTime : measureCursor

        if (isRest) {
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

          if (!tieStart) {
            events.push({
              partId: pendingTie.partId,
              partName: pendingTie.partName,
              instrumentName: pendingTie.instrumentName,
              samplerId: pendingTie.samplerId,
              time: pendingTie.startTime,
              duration: pendingTie.duration,
              note: pendingTie.note,
              playbackKey: pendingTie.playbackKey,
              midi: pendingTie.midi,
              lyric: pendingTie.lyric,
              voice: pendingTie.voice,
              measureNumber: pendingTie.measureNumber,
            })
            pendingTies.delete(tieKey)
          }

          if (!isChord) {
            voiceTicks.set(voice, startTime + duration)
            measureCursor = startTime + duration
          }
          return
        }

        if (tieStart && !tieStop) {
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
          })

          if (!isChord) {
            voiceTicks.set(voice, startTime + duration)
            measureCursor = startTime + duration
          }
          return
        }

        if (tieStart && tieStop) {
          const mergedTie = pendingTie ?? {
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
            duration: 0,
            measureNumber: measureIndex + 1,
          }

          mergedTie.duration += duration
          mergedTie.lyric = mergedTie.lyric ?? lyric
          pendingTies.set(tieKey, mergedTie)

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
          measureNumber: measureIndex + 1,
        })

        if (!isChord) {
          voiceTicks.set(voice, startTime + duration)
          measureCursor = startTime + duration
        }
      })
    })

    pendingTies.forEach((pendingTie) => {
      events.push({
        partId: pendingTie.partId,
        partName: pendingTie.partName,
        instrumentName: pendingTie.instrumentName,
        samplerId: pendingTie.samplerId,
        time: pendingTie.startTime,
        duration: pendingTie.duration,
        note: pendingTie.note,
        playbackKey: pendingTie.playbackKey,
        midi: pendingTie.midi,
        lyric: pendingTie.lyric,
        voice: pendingTie.voice,
        measureNumber: pendingTie.measureNumber,
      })
    })
  })

  return events.sort(
    (left, right) =>
      left.time - right.time ||
      left.partId.localeCompare(right.partId) ||
      left.voice.localeCompare(right.voice)
  )
}
