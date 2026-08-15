type AudioSessionType =
  | 'ambient'
  | 'auto'
  | 'play-and-record'
  | 'playback'
  | 'transient'
  | 'transient-solo'

type AudioSession = {
  type: AudioSessionType
}

type NavigatorWithAudioSession = Navigator & {
  audioSession?: AudioSession
}

/**
 * Treats app audio as user-requested media playback on supporting browsers.
 * In particular, WebKit uses this hint to keep Web Audio audible while an
 * iPhone's Ring/Silent switch is set to silent.
 */
export const configurePlaybackAudioSession = (
  target: NavigatorWithAudioSession = navigator as NavigatorWithAudioSession
): boolean => {
  const audioSession = target.audioSession
  if (!audioSession) return false

  try {
    audioSession.type = 'playback'
    return audioSession.type === 'playback'
  } catch {
    // Audio Session is experimental. A browser may expose the property while
    // rejecting a type that it does not implement, so preserve normal audio.
    return false
  }
}
