import WebMscore from 'webmscore'

import { injectHarmonyText } from './audioSync'

interface MusicScoreExport {
  musicXml: string
  musicMxl: Uint8Array | null
}

export const convertMsczToMusicXml = async (
  fileBinary: Uint8Array
): Promise<MusicScoreExport> => {
  const score = await WebMscore.load('mscz', fileBinary, [], true)

  const rawXml = await score.saveXml()
  const musicXml = injectHarmonyText(rawXml)

  let musicMxl: Uint8Array | null = null
  try {
    musicMxl = await score.saveMxl()
  } catch {
    console.warn('MXLの生成に失敗しましたが、XMLは生成されました')
  }

  return { musicXml, musicMxl }
}
