import * as Tone from 'tone'

const PIANO_MAP = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  Ds1: 'Ds1.mp3',
  Fs1: 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  Ds2: 'Ds2.mp3',
  Fs2: 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  Ds3: 'Ds3.mp3',
  Fs3: 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  Ds4: 'Ds4.mp3',
  Fs4: 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  Ds5: 'Ds5.mp3',
  Fs5: 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  Ds6: 'Ds6.mp3',
  Fs6: 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  Ds7: 'Ds7.mp3',
  Fs7: 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
}

export const initPianoSampler = () => {
  return new Tone.Sampler({
    urls: PIANO_MAP,
    baseUrl: '/sounds/piano/',
    onload: () => {
      console.log('🎹 ピアノのロード完了！')
    },
  }).toDestination()
}
