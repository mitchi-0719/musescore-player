import { useCallback, useEffect, useState } from 'react'
import { useScoreStore } from '../stores/useScoreStore'


export default function PlayerControls() {
  const player = useScoreStore((s) => s.player)
  const isPlaying = useScoreStore((s) => s.isPlaying)
  const currentTime = useScoreStore((s) => s.currentTime)
  const tempo = useScoreStore((s) => s.tempo)
  const volume = useScoreStore((s) => s.volume)
  const totalDuration = useScoreStore((s) => s.totalDuration)
  const setTempo = useScoreStore((s) => s.setTempo)
  const setVolume = useScoreStore((s) => s.setVolume)
  const setCurrentTime = useScoreStore((s) => s.setCurrentTime)

  const [localTempo, setLocalTempo] = useState(tempo)
  const [isDraggingSeek, setIsDraggingSeek] = useState(false)
  const [seekValue, setSeekValue] = useState(currentTime)

  useEffect(() => setLocalTempo(tempo), [tempo])

  useEffect(() => {
    if (!isDraggingSeek) {
      setSeekValue(currentTime)
    }
  }, [currentTime, isDraggingSeek])

  const handlePlay = useCallback(async () => {
    try {
      await player?.play()
    } catch (e) {
      console.error('Play error:', e)
    }
  }, [player])

  const handlePause = useCallback(() => {
    player?.pause()
  }, [player])

  const handleStop = useCallback(() => {
    player?.pause()
    player?.seek(0)
    setCurrentTime(0)
    setSeekValue(0)
  }, [player, setCurrentTime])

  const handleTempoChange = useCallback(
    (v: number) => {
      setLocalTempo(v)
      setTempo(v)
      player?.setTempo(v)
    },
    [player, setTempo]
  )

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v)
      // player volume handling not implemented in MVP
    },
    [setVolume]
  )

  const handleSeekStart = useCallback(() => {
    setIsDraggingSeek(true)
  }, [])

  const handleSeekChange = useCallback((v: number) => {
    setSeekValue(v)
  }, [])

  const handleSeekEnd = useCallback(
    (v: number) => {
      setIsDraggingSeek(false)
      player?.seek(v)
      setCurrentTime(v)
    },
    [player, setCurrentTime]
  )

  const progressPercent =
    totalDuration > 0 ? (seekValue / totalDuration) * 100 : 0

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-white p-4">
      {/* Progress Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600 sm:text-sm">
            {formatTime(seekValue)}
          </span>
          <span className="text-xs text-gray-600 sm:text-sm">
            {formatTime(totalDuration)}
          </span>
        </div>
        <div className="relative h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.1}
            value={seekValue}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={(e) => handleSeekChange(Number(e.target.value))}
            onMouseUp={(e) => handleSeekEnd(Number(e.currentTarget.value))}
            onTouchEnd={(e) =>
              handleSeekEnd(Number((e.target as HTMLInputElement).value))
            }
            aria-label="再生位置"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </div>

      {/* Play Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={handlePlay}
          aria-label="再生"
          className="rounded bg-green-500 px-3 py-2 text-sm text-white transition-opacity hover:bg-green-600 disabled:opacity-60 sm:px-4"
          disabled={!player}
        >
          ▶️ 再生
        </button>
        <button
          type="button"
          onClick={handlePause}
          aria-label="一時停止"
          className="rounded bg-yellow-400 px-3 py-2 text-sm text-white transition-opacity hover:bg-yellow-500 disabled:opacity-60 sm:px-4"
          disabled={!player}
        >
          ⏸ 一時停止
        </button>
        <button
          type="button"
          onClick={handleStop}
          aria-label="停止"
          className="rounded bg-red-500 px-3 py-2 text-sm text-white transition-opacity hover:bg-red-600 disabled:opacity-60 sm:px-4"
          disabled={!player}
        >
          ⏹ 停止
        </button>
      </div>

      {/* Tempo Control */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label className="text-xs text-gray-600 sm:min-w-fit sm:text-sm">
          テンポ
        </label>
        <div className="flex flex-1 items-center gap-2">
          <input
            type="range"
            min={40}
            max={220}
            value={localTempo}
            aria-label="テンポ"
            onChange={(e) => handleTempoChange(Number(e.target.value))}
            className="flex-1"
          />
          <div className="min-w-12 text-right text-xs sm:text-sm">
            {localTempo} BPM
          </div>
        </div>
      </div>

      {/* Volume Control */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label className="text-xs text-gray-600 sm:min-w-fit sm:text-sm">
          ボリューム
        </label>
        <div className="flex flex-1 items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            aria-label="ボリューム"
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1"
          />
          <div className="min-w-12 text-right text-xs sm:text-sm">
            {Math.round(volume * 100)}%
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(t: number) {
  if (!isFinite(t)) return '00:00'
  const sec = Math.max(0, Math.floor(t))
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
