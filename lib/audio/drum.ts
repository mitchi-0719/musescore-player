import * as Tone from 'tone'

import { DRUM_MAP } from '@/constants/drum'

export const initDrumSampler = () => {
  return new Tone.Sampler({
    urls: DRUM_MAP,
    baseUrl: '/sounds/drums/',
    onload: () => {
      console.log('🥁 カスタムドラムキットのロード完了！')
    },
  }).toDestination()
}
