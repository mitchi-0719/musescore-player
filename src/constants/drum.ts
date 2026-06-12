export const DRUM_MAP: Record<string, string> = {
  C1: 'Std Kick.wav',
  'C#1': 'Rim Tap.wav',
  D1: 'Std Snr 1.wav',
  'D#1': 'Std Snr 1.wav',
  E1: 'Hi-Hat Closed.wav',
  F1: 'Low Flr Studio.wav',
  'F#1': 'Hi-Hat Foot.wav',
  G1: 'Flr Studio.wav',
  'G#1': 'Low Studio.wav',
  A1: 'Hi-Hat Half-Open.wav',
  'A#1': 'Md Studio(L).wav',
  B1: 'MdHi Studio(L).wav',
  C2: 'Crsh 1.wav',
  'C#2': 'Hi Studio.wav',
  D2: 'Tambourine.wav',
  'D#2': 'China Crash.wav',
  E2: 'BellRide.wav',
  F2: 'Splash.wav',
  'F#2': 'Splash.wav',
  G2: 'Cow Bell.wav',
  'G#2': 'Crsh 2.wav',
}

export const DRUM_SAMPLE_KEY_BY_LABEL: Record<string, string> = {
  bassdrum2: 'C1',
  bassdrum1: 'C1',
  sidestick: 'C#1',
  acousticsnare: 'D1',
  electricsnare: 'D#1',
  lowfloortom: 'F1',
  closedhihat: 'E1',
  highfloortom: 'F#1',
  pedalhihat: 'F#1',
  lowtom: 'G1',
  openhihat: 'G#1',
  lowmidtom: 'A1',
  himidtom: 'A#1',
  crashcymbal1: 'C2',
  hightom: 'C2',
  ridecymbal1: 'C#2',
  chinacymbal: 'D2',
  ridebell: 'D#2',
  tambourine: 'E2',
  splashcymbal: 'F2',
  cowbell: 'F#2',
  crashcymbal2: 'G2',
  ridecymbal2: 'G#2',
  handclap: 'C4',
  clap: 'C4',
}

// Mapping from General MIDI unpitched (percussion) numbers to sampler keys.
export const MIDI_UNPITCHED_TO_KEY: Record<number, string> = {
  35: 'C1', // Acoustic Bass Drum
  36: 'C1', // Bass Drum 1
  37: 'C#1', // Side Stick
  38: 'D1', // Acoustic Snare
  39: 'C4', // Hand Clap
  40: 'D#1', // Electric Snare
  41: 'F1', // Low Floor Tom
  42: 'E1', // Closed Hi-Hat
  43: 'G1', // High Floor Tom
  44: 'F#1', // Pedal Hi-Hat
  45: 'G#1', // Low Tom
  46: 'A1', // Open Hi-Hat
  47: 'A#1', // Low-Mid Tom
  48: 'B1', // Hi-Mid Tom
  49: 'C2', // Crash Cymbal 1
  50: 'C#2', // High Tom
  51: 'D2', // Ride Cymbal 1
  52: 'D#2', // Chinese Cymbal
  53: 'E2', // Ride Bell
  54: 'F2', // Tambourine
  55: 'F#2', // Splash Cymbal
  56: 'G2', // Cowbell
  57: 'G#2', // Crash Cymbal 2
  58: 'A2', // Vibra Slap
  59: 'A#2',
  60: 'B2',
}
