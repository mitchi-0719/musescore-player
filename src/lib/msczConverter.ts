import { logger } from './logger'

interface MusicScoreExport {
  musicXml: string
  musicMxl: Uint8Array | null
}

type MusicXmlPitch = {
  step: string
  alter: number
}

type MscxHarmony = {
  root: MusicXmlPitch | null
  bass: MusicXmlPitch | null
  name: string
}

type ChordKind = {
  kind: string
  text?: string
}

type RestoreHarmonyResult = {
  musicXml: string
}

type MscxChordPlayback = {
  tremoloMarks: number | null
}

const HARMONY_TAG_PATTERN = /<harmony\b[\s\S]*?<\/harmony>/g
const DIRECTION_TAG_PATTERN = /<direction\b[\s\S]*?<\/direction>/g
const DIRECTION_TYPE_TAG_PATTERN = /<direction-type\b[\s\S]*?<\/direction-type>/
const NOTE_TAG_PATTERN = /<note\b[\s\S]*?<\/note>/g

const assertPlayableMusicXml = (musicXml: string): void => {
  const doc = new DOMParser().parseFromString(musicXml, 'application/xml')
  const hasParserError = Boolean(doc.querySelector('parsererror'))
  const scoreParts = doc.querySelectorAll('part-list > score-part').length
  const parts = doc.querySelectorAll('score-partwise > part').length
  const measures = doc.querySelectorAll(
    'score-partwise > part > measure'
  ).length

  if (hasParserError || scoreParts === 0 || parts === 0 || measures === 0) {
    throw new Error(
      'MSCZ を MusicXML に変換できませんでした。MuseScore でファイルを開き、最新版の MSCZ として保存し直してください。'
    )
  }
}

const STEP_BY_INDEX = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL_TPC_BY_STEP: Record<string, number> = {
  C: 14,
  D: 16,
  E: 18,
  F: 13,
  G: 15,
  A: 17,
  B: 19,
}

const CHORD_KIND_BY_NAME: Record<string, ChordKind> = {
  '': { kind: 'major' },
  m: { kind: 'minor', text: 'm' },
  min: { kind: 'minor', text: 'm' },
  minor: { kind: 'minor', text: 'm' },
  '+': { kind: 'augmented', text: 'aug' },
  aug: { kind: 'augmented', text: 'aug' },
  dim: { kind: 'diminished', text: 'dim' },
  o: { kind: 'diminished', text: 'dim' },
  '7': { kind: 'dominant', text: '7' },
  '/7': { kind: 'dominant', text: '7' },
  maj7: { kind: 'major-seventh', text: 'maj7' },
  M7: { kind: 'major-seventh', text: 'maj7' },
  m7: { kind: 'minor-seventh', text: 'm7' },
  dim7: { kind: 'diminished-seventh', text: 'dim7' },
  aug7: { kind: 'augmented-seventh', text: 'aug7' },
  m7b5: { kind: 'half-diminished', text: 'm7b5' },
  'm7-5': { kind: 'half-diminished', text: 'm7-5' },
  ø: { kind: 'half-diminished', text: 'm7b5' },
  'm(maj7)': { kind: 'major-minor', text: 'm(maj7)' },
  '6': { kind: 'major-sixth', text: '6' },
  maj6: { kind: 'major-sixth', text: 'maj6' },
  m6: { kind: 'minor-sixth', text: 'm6' },
  '9': { kind: 'dominant-ninth', text: '9' },
  maj9: { kind: 'major-ninth', text: 'maj9' },
  m9: { kind: 'minor-ninth', text: 'm9' },
  '11': { kind: 'dominant-11th', text: '11' },
  maj11: { kind: 'major-11th', text: 'maj11' },
  m11: { kind: 'minor-11th', text: 'm11' },
  '13': { kind: 'dominant-13th', text: '13' },
  maj13: { kind: 'major-13th', text: 'maj13' },
  m13: { kind: 'minor-13th', text: 'm13' },
  sus2: { kind: 'suspended-second', text: '2' },
  sus4: { kind: 'suspended-fourth', text: '4' },
  '5': { kind: 'power', text: '5' },
}

const modulo = (value: number, divisor: number) =>
  ((value % divisor) + divisor) % divisor

const getDirectChild = (element: Element, tagName: string): Element | null => {
  return (
    Array.from(element.children).find((child) => child.tagName === tagName) ??
    null
  )
}

const getDirectChildText = (element: Element, tagName: string): string => {
  return getDirectChild(element, tagName)?.textContent?.trim() ?? ''
}

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const normalizeTextTempoDirections = (musicXml: string): string =>
  musicXml.replace(DIRECTION_TAG_PATTERN, (direction) => {
    if (
      /<metronome\b/.test(direction) ||
      !/<sound\b[^>]*tempo=/.test(direction)
    ) {
      return direction
    }

    // MuseScore がテンポ記号を Leland Text の私用領域グリフと words に
    // 分けて出力する場合がある。OSMD ではそのグリフを描画できないため、
    // 表示されている「= 数値」を標準 MusicXML の metronome に戻す。
    const directionText = direction
      .replace(/<[^>]+>/g, '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&#160;', ' ')
    const tempoMatch = directionText.match(/=\s*(\d+(?:\.\d+)?)/)
    if (!tempoMatch || !DIRECTION_TYPE_TAG_PATTERN.test(direction)) {
      return direction
    }

    return direction.replace(
      DIRECTION_TYPE_TAG_PATTERN,
      `<direction-type>
          <metronome parentheses="no">
            <beat-unit>quarter</beat-unit>
            <per-minute>${tempoMatch[1]}</per-minute>
            </metronome>
          </direction-type>`
    )
  })

const tpcToMusicXmlPitch = (value: string): MusicXmlPitch | null => {
  if (!value.trim()) return null

  const tpc = Number(value)
  if (!Number.isFinite(tpc)) return null

  const step = STEP_BY_INDEX[modulo((tpc - 14) * 4, 7)]
  if (!step) return null

  const alter = (tpc - NATURAL_TPC_BY_STEP[step]) / 7
  if (!Number.isInteger(alter)) return null

  return { step, alter }
}

const getChordKind = (name: string): ChordKind => {
  const normalized = name.trim()
  return (
    CHORD_KIND_BY_NAME[normalized] ?? {
      kind: 'major',
      text: normalized || undefined,
    }
  )
}

const findMscxFile = async (fileBinary: Uint8Array): Promise<string | null> => {
  if (fileBinary.byteLength === 0) {
    logger.warn('MSCZバイナリが空のためMSCXを読み込めません')
    return null
  }

  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(fileBinary)
    const mscxEntry = Object.values(zip.files).find(
      (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.mscx')
    )

    return mscxEntry ? await mscxEntry.async('string') : null
  } catch (error) {
    logger.warn('MSCZ内のMSCX読み込みに失敗しました:', error)
    return null
  }
}

const extractMscxHarmonies = (mscx: string): MscxHarmony[] => {
  const doc = new DOMParser().parseFromString(mscx, 'application/xml')
  if (doc.querySelector('parsererror')) {
    return []
  }

  return Array.from(doc.querySelectorAll('Harmony'))
    .map((harmony) => {
      const harmonyInfo = getDirectChild(harmony, 'harmonyInfo')
      if (!harmonyInfo) return null
      const rootTpc = getDirectChildText(harmonyInfo, 'root')
      const bassTpc = getDirectChildText(harmonyInfo, 'bass')

      return {
        root: tpcToMusicXmlPitch(rootTpc),
        bass: tpcToMusicXmlPitch(bassTpc),
        name: getDirectChildText(harmonyInfo, 'name'),
      }
    })
    .filter((harmony): harmony is MscxHarmony => Boolean(harmony?.root))
}

const extractMscxChordPlayback = (mscx: string): MscxChordPlayback[] => {
  const doc = new DOMParser().parseFromString(mscx, 'application/xml')
  if (doc.querySelector('parsererror')) return []

  return Array.from(doc.querySelectorAll('Chord')).map((chord) => {
    const subtype = getDirectChild(chord, 'TremoloSingleChord')?.querySelector(
      ':scope > subtype'
    )?.textContent
    const denominator = Number(subtype?.match(/^r(\d+)$/)?.[1])
    const tremoloMarks = Math.log2(denominator) - 2

    return {
      tremoloMarks:
        Number.isInteger(tremoloMarks) && tremoloMarks >= 1
          ? tremoloMarks
          : null,
    }
  })
}

const addTremoloNotation = (noteXml: string, marks: number): string => {
  const tremolo = `<tremolo type="single">${marks}</tremolo>`

  if (/<ornaments\b/.test(noteXml)) {
    return noteXml.replace(/<\/ornaments>/, `${tremolo}</ornaments>`)
  }
  if (/<notations\b/.test(noteXml)) {
    return noteXml.replace(
      /<\/notations>/,
      `<ornaments>${tremolo}</ornaments></notations>`
    )
  }

  const notation = `<notations><ornaments>${tremolo}</ornaments></notations>`
  return /<(lyric|play|listen)\b/.test(noteXml)
    ? noteXml.replace(/<(lyric|play|listen)\b/, `${notation}<$1`)
    : noteXml.replace(/<\/note>/, `${notation}</note>`)
}

const restoreTremolos = (
  musicXml: string,
  chordPlayback: MscxChordPlayback[]
): string => {
  if (!chordPlayback.some(({ tremoloMarks }) => tremoloMarks !== null)) {
    return musicXml
  }

  const playableNotes = musicXml
    .match(NOTE_TAG_PATTERN)
    ?.filter((note) => !/<rest\b/.test(note) && !/<chord\s*\/?\s*>/.test(note))
  if (!playableNotes || playableNotes.length !== chordPlayback.length) {
    logger.warn('Chord数が一致しないためロール補正をスキップしました', {
      musicXmlChordCount: playableNotes?.length ?? 0,
      mscxChordCount: chordPlayback.length,
    })
    return musicXml
  }

  let chordIndex = 0
  return musicXml.replace(NOTE_TAG_PATTERN, (note) => {
    if (/<rest\b/.test(note) || /<chord\s*\/?\s*>/.test(note)) return note

    const tremoloMarks = chordPlayback[chordIndex++]?.tremoloMarks
    return tremoloMarks === null || tremoloMarks === undefined
      ? note
      : addTremoloNotation(note, tremoloMarks)
  })
}

const addPitchXml = (
  lines: string[],
  tagName: 'root' | 'bass',
  pitch: MusicXmlPitch
) => {
  const prefix = tagName === 'root' ? 'root' : 'bass'
  const arrangement = tagName === 'bass' ? ' arrangement="horizontal"' : ''

  lines.push(`        <${tagName}${arrangement}>`)
  lines.push(`          <${prefix}-step>${pitch.step}</${prefix}-step>`)
  if (pitch.alter !== 0) {
    lines.push(`          <${prefix}-alter>${pitch.alter}</${prefix}-alter>`)
  }
  lines.push(`          </${tagName}>`)
}

const buildHarmonyXml = (harmony: MscxHarmony): string => {
  const lines = ['<harmony print-frame="no">']
  const chordKind = getChordKind(harmony.name)

  if (harmony.root) {
    addPitchXml(lines, 'root', harmony.root)
  }

  const text = chordKind.text ? ` text="${escapeXml(chordKind.text)}"` : ''
  lines.push(`        <kind${text}>${chordKind.kind}</kind>`)

  if (harmony.bass) {
    addPitchXml(lines, 'bass', harmony.bass)
  }

  lines.push('        </harmony>')
  return lines.join('\n')
}

const restoreHarmonyFromMscz = async (
  musicXml: string,
  fileBinary: Uint8Array
): Promise<RestoreHarmonyResult> => {
  const mscx = await findMscxFile(fileBinary)
  if (!mscx) {
    return {
      musicXml,
    }
  }

  const harmonies = extractMscxHarmonies(mscx)
  const chordPlayback = extractMscxChordPlayback(mscx)
  const musicXmlWithTremolos = restoreTremolos(musicXml, chordPlayback)
  if (!harmonies.length) {
    return {
      musicXml: musicXmlWithTremolos,
    }
  }

  const harmonyMatches = musicXml.match(HARMONY_TAG_PATTERN) ?? []
  if (harmonyMatches.length !== harmonies.length) {
    logger.warn('Harmony数が一致しないためコード補正をスキップしました', {
      musicXmlHarmonyCount: harmonyMatches.length,
      mscxHarmonyCount: harmonies.length,
    })
    return {
      musicXml: musicXmlWithTremolos,
    }
  }

  let harmonyIndex = 0
  return {
    musicXml: musicXmlWithTremolos.replace(HARMONY_TAG_PATTERN, () =>
      buildHarmonyXml(harmonies[harmonyIndex++])
    ),
  }
}

export const convertMsczToMusicXml = async (
  fileBinary: Uint8Array
): Promise<MusicScoreExport> => {
  const webMscoreBinary = fileBinary.slice()
  const msczArchiveBinary = fileBinary.slice()

  const WebMscore = (await import('webmscore')).default
  const score = await WebMscore.load('mscz', webMscoreBinary, [], true)

  const rawMusicXml = await score.saveXml()
  assertPlayableMusicXml(rawMusicXml)
  const restoreResult = await restoreHarmonyFromMscz(
    rawMusicXml,
    msczArchiveBinary
  )
  const musicXml = normalizeTextTempoDirections(restoreResult.musicXml)

  let musicMxl: Uint8Array | null = null
  try {
    musicMxl = await score.saveMxl()
  } catch {
    logger.warn('MXLの生成に失敗しましたが、XMLは生成されました')
  }

  return { musicXml, musicMxl }
}
