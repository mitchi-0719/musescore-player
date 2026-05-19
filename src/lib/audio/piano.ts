import * as Tone from 'tone'
import { PIANO_MAP } from '../../constants/piano'


export const initPianoSampler = () => {
  return new Tone.Sampler({
    urls: PIANO_MAP,
    baseUrl: '/sounds/piano/',
    onload: () => {
      console.log('🎹 ピアノのロード完了！')
    },
  }).toDestination()
}
