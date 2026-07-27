import { type FC } from 'react'

import type { AudioMixerControls } from '../../hooks/useAudioPlayer'
import { useOnOffState } from '../../hooks/useOnOffState'
import { useScoreStore } from '../../stores/useScoreStore'
import { Icon } from '../ui/Icon'
import { MixerPanel } from './MixerPanel'

type ControlModalProps = {
  play: () => void
  stop: () => void
  mixerControls: AudioMixerControls
}

export const ControlModal: FC<ControlModalProps> = ({
  play,
  stop,
  mixerControls,
}) => {
  const { state: isOpen, toggle: toggleDrawer } = useOnOffState(false)
  const stopEventPropagation = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
  }

  return (
    <div
      className={`fixed bottom-0 left-0 z-50 w-full bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-y-0' : 'translate-y-40'
      }`}
      onClick={stopEventPropagation}
      onPointerDown={stopEventPropagation}
      onPointerMove={stopEventPropagation}
      onPointerUp={stopEventPropagation}
      onPointerCancel={stopEventPropagation}
      onTouchStart={stopEventPropagation}
      onTouchMove={stopEventPropagation}
      onTouchEnd={stopEventPropagation}
      onTouchCancel={stopEventPropagation}
      onWheel={stopEventPropagation}
      onScrollCapture={stopEventPropagation}
    >
      <div className="w-full">
        <DrawerHeader
          isOpen={isOpen}
          toggleOpen={toggleDrawer}
          play={play}
          stop={stop}
        />
      </div>

      <div className="h-40 w-full overflow-y-auto px-4 py-3">
        <MixerPanel mixerControls={mixerControls} />
      </div>
    </div>
  )
}

type HeaderProps = {
  isOpen: boolean
  toggleOpen: () => void
  play: () => void
  stop: () => void
}

const DrawerHeader: FC<HeaderProps> = ({ isOpen, toggleOpen, play, stop }) => {
  const isPlaying = useScoreStore((state) => state.isPlaying)

  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-1">
      <button
        disabled
        className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md bg-gray-50 text-gray-500 opacity-50"
        aria-label="メモ"
      >
        <Icon name="edit" className="h-6 w-6" />
      </button>

      <button
        onClick={() => {
          if (isPlaying) {
            stop()
          } else {
            play()
          }
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-transform hover:bg-blue-700 active:scale-95"
        aria-label={isPlaying ? '停止' : '再生'}
      >
        {isPlaying ? (
          <Icon name="pause" className="h-7 w-7" />
        ) : (
          <Icon name="play" className="h-7 w-7" />
        )}
      </button>

      <button
        onClick={toggleOpen}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100"
        aria-label={isOpen ? 'ドロワーを閉じる' : 'ドロワーを開く'}
      >
        {isOpen ? (
          <Icon name="arrow-down" className="h-7 w-7" />
        ) : (
          <Icon name="arrow-up" className="h-7 w-7" />
        )}
      </button>
    </div>
  )
}
