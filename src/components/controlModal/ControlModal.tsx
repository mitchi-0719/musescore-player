import { type FC, useEffect, useRef, useState } from 'react'

import type {
  AudioMixerControls,
  AudioPlaybackControls,
} from '../../hooks/useAudioPlayer'
import { useOnOffState } from '../../hooks/useOnOffState'
import { useScoreStore } from '../../stores/useScoreStore'
import { Icon } from '../ui/Icon'
import { MixerPanel } from './MixerPanel'

type ControlModalProps = {
  play: () => void
  stop: () => void
  mixerControls: AudioMixerControls
  playbackControls: AudioPlaybackControls
  zoomIn: () => void
  zoomOut: () => void
  zoomPercentage: number
  isZoomRendering: boolean
}

export const ControlModal: FC<ControlModalProps> = ({
  play,
  stop,
  mixerControls,
  playbackControls,
  zoomIn,
  zoomOut,
  zoomPercentage,
  isZoomRendering,
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
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          zoomPercentage={zoomPercentage}
          isZoomRendering={isZoomRendering}
        />
      </div>

      <div className="h-40 w-full overflow-y-auto px-4 py-3">
        <PlaybackPositionControl playbackControls={playbackControls} />
        <TempoControl />
        <MixerPanel mixerControls={mixerControls} />
      </div>
    </div>
  )
}

const formatTime = (time: number) => {
  const wholeSeconds = Math.max(0, Math.floor(time))
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const PlaybackPositionControl: FC<{
  playbackControls: AudioPlaybackControls
}> = ({ playbackControls }) => {
  const [sliderTime, setSliderTime] = useState(playbackControls.currentTime)
  const sliderTimeRef = useRef(playbackControls.currentTime)
  const isDraggingRef = useRef(false)
  const hasPendingSeekRef = useRef(false)
  const lastCommittedTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isDraggingRef.current && !hasPendingSeekRef.current) {
      sliderTimeRef.current = playbackControls.currentTime
      lastCommittedTimeRef.current = playbackControls.currentTime
      setSliderTime(playbackControls.currentTime)
    }
  }, [playbackControls.currentTime])

  const updateSlider = (time: number) => {
    sliderTimeRef.current = time
    setSliderTime(time)
    if (!isDraggingRef.current) {
      if (lastCommittedTimeRef.current !== time) {
        lastCommittedTimeRef.current = time
        playbackControls.seek(time)
      }
      hasPendingSeekRef.current = false
      return
    }
    hasPendingSeekRef.current = true
  }

  const commitSeek = (finalTime = sliderTimeRef.current) => {
    isDraggingRef.current = false
    if (!hasPendingSeekRef.current) return

    sliderTimeRef.current = finalTime
    setSliderTime(finalTime)
    hasPendingSeekRef.current = false
    lastCommittedTimeRef.current = finalTime
    playbackControls.seek(finalTime)
  }

  return (
    <div className="mb-3 flex items-center gap-3 border-b border-gray-200 pb-3">
      <input
        type="range"
        min={0}
        max={playbackControls.totalDuration || 1}
        step={0.1}
        value={sliderTime}
        disabled={playbackControls.totalDuration === 0}
        className="min-w-36 flex-1 disabled:opacity-40"
        aria-label="再生位置"
        onPointerDown={() => {
          isDraggingRef.current = true
        }}
        onChange={(event) => updateSlider(Number(event.target.value))}
        onPointerUp={(event) => commitSeek(Number(event.currentTarget.value))}
        onPointerCancel={(event) =>
          commitSeek(Number(event.currentTarget.value))
        }
        onLostPointerCapture={(event) =>
          commitSeek(Number(event.currentTarget.value))
        }
        onKeyUp={(event) => commitSeek(Number(event.currentTarget.value))}
        onBlur={(event) => commitSeek(Number(event.currentTarget.value))}
      />
      <output
        className="shrink-0 text-xs text-gray-700 tabular-nums"
        aria-live="off"
      >
        {formatTime(sliderTime)}/{formatTime(playbackControls.totalDuration)}
      </output>
    </div>
  )
}

const TempoControl = () => {
  const tempoPercentage = useScoreStore((state) => state.tempoPercentage)
  const setTempoPercentage = useScoreStore((state) => state.setTempoPercentage)
  const decreaseTempo = () =>
    setTempoPercentage(Math.max(25, tempoPercentage - 5))
  const increaseTempo = () =>
    setTempoPercentage(Math.min(200, tempoPercentage + 5))

  return (
    <div className="mb-3 flex items-center gap-2 border-b border-gray-200 pb-3">
      <span className="mr-1 text-xs text-gray-700">テンポ</span>
      <button
        type="button"
        onClick={decreaseTempo}
        disabled={tempoPercentage <= 25}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="テンポを5%下げる"
      >
        <Icon name="remove" size="small" />
      </button>
      <output
        className="flex w-12 items-center justify-center text-center text-xs font-medium text-gray-700 tabular-nums"
        aria-label={`現在のテンポ: ${tempoPercentage}%`}
        aria-live="polite"
      >
        {tempoPercentage}%
      </output>
      <button
        type="button"
        onClick={increaseTempo}
        disabled={tempoPercentage >= 200}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="テンポを5%上げる"
      >
        <Icon name="add" size="small" />
      </button>
    </div>
  )
}

type HeaderProps = {
  isOpen: boolean
  toggleOpen: () => void
  play: () => void
  stop: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomPercentage: number
  isZoomRendering: boolean
}

const DrawerHeader: FC<HeaderProps> = ({
  isOpen,
  toggleOpen,
  play,
  stop,
  zoomIn,
  zoomOut,
  zoomPercentage,
  isZoomRendering,
}) => {
  const isPlaying = useScoreStore((state) => state.isPlaying)

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-gray-200 bg-white px-4 py-1">
      <div className="flex items-center justify-self-start">
        <button
          onClick={zoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 active:scale-95"
          aria-label="楽譜を縮小"
        >
          <Icon name="remove" size="small" />
        </button>
        <output
          className="flex w-12 items-center justify-center text-center text-xs font-medium text-gray-700 tabular-nums"
          aria-label={
            isZoomRendering
              ? '楽譜を再描画しています'
              : `現在の楽譜サイズ: ${zoomPercentage}%`
          }
          aria-live="polite"
        >
          {isZoomRendering ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
              aria-hidden="true"
            />
          ) : (
            `${zoomPercentage}%`
          )}
        </output>
        <button
          onClick={zoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 active:scale-95"
          aria-label="楽譜を拡大"
        >
          <Icon name="add" size="small" />
        </button>
      </div>

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
          <Icon name="pause" size="large" />
        ) : (
          <Icon name="play" size="large" />
        )}
      </button>

      <button
        onClick={toggleOpen}
        className="flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-gray-600 transition-colors hover:bg-gray-100"
        aria-label={isOpen ? 'ドロワーを閉じる' : 'ドロワーを開く'}
      >
        {isOpen ? (
          <Icon name="arrow-down" size="large" />
        ) : (
          <Icon name="arrow-up" size="large" />
        )}
      </button>
    </div>
  )
}
