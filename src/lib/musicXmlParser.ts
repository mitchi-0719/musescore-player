export type NoteEvent = { time: number; duration: number; midi: number }

// 定数として外に出す（ループのたびに作らないようにする）
const STEP_MAP: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const getTempo = (doc: Document): number => {
  // 優先度1: <sound tempo="..."> タグを探す
  const soundTempo = doc.querySelector('sound[tempo]')
  if (soundTempo) {
    const t = Number(soundTempo.getAttribute('tempo'))
    if (!isNaN(t) && t > 0) return t
  }

  // 優先度2: <metronome> タグ内の <per-minute> を探す
  const metronome = doc.querySelector('metronome per-minute')
  if (metronome && metronome.textContent) {
    const t = Number(metronome.textContent)
    if (!isNaN(t) && t > 0) return t
  }

  // デフォルト値: テンポ情報がない場合は 120 を返す
  return 120
}

export const parseMusicXmlForEvents = (musicXml: string) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(musicXml, 'application/xml')

  const divisions = Number(doc.querySelector('divisions')?.textContent || '1')
  const tempo = getTempo(doc) // テンポ取得を分離

  const events: NoteEvent[] = []
  let currentTime = 0

  // 全ての measure を順次処理
  doc.querySelectorAll('part > measure').forEach((measure) => {
    measure.querySelectorAll('note').forEach((note) => {
      const isRest = !!note.querySelector('rest')
      const isChord = !!note.querySelector('chord')
      const duration = Number(
        note.querySelector('duration')?.textContent || '0'
      )
      const durSec = (duration / divisions) * (60 / tempo)

      if (!isRest) {
        const midi = calculateMidi(note)
        events.push({ time: currentTime, duration: durSec, midi })
      }

      // 和音でなければ時間を進める
      if (!isChord) {
        currentTime += durSec
      }
    })
  })

  return { events, tempo, total: currentTime }
}

// MIDI計算用のヘルパー関数
const calculateMidi = (note: Element): number => {
  const step = note.querySelector('pitch > step')?.textContent || 'C'
  const alter = Number(note.querySelector('pitch > alter')?.textContent || '0')
  const octave = Number(
    note.querySelector('pitch > octave')?.textContent || '4'
  )
  return (octave + 1) * 12 + (STEP_MAP[step] ?? 0) + (isNaN(alter) ? 0 : alter)
}
