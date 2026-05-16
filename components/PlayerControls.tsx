'use client'

import { useCallback, useEffect, useState } from 'react'

import { useScoreStore } from '@/stores/useScoreStore'

export default function PlayerControls() {
  const player = useScoreStore((s) => s.player)
  const isPlaying = useScoreStore((s) => s.isPlaying)
  const currentTime = useScoreStore((s) => s.currentTime)
  const tempo = useScoreStore((s) => s.tempo)
  const volume = useScoreStore((s) => s.volume)
  const setTempo = useScoreStore((s) => s.setTempo)
  const setVolume = useScoreStore((s) => s.setVolume)
  const setCurrentTime = useScoreStore((s) => s.setCurrentTime)

  const [localTempo, setLocalTempo] = useState(tempo)

  useEffect(() => setLocalTempo(tempo), [tempo])

  const handlePlay = useCallback(async () => {
    try {
      await player?.play()
    } catch (e) {
      console.error(e)
    }
  }, [player])

  const handlePause = useCallback(() => {
    player?.pause()
  }, [player])

  const handleStop = useCallback(() => {
    player?.pause()
    player?.seek(0)
    setCurrentTime(0)
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePlay}
          aria-label="再生"
          className="rounded bg-green-500 px-3 py-1 text-white disabled:opacity-60"
          disabled={!player}
        >
          再生
        </button>
        <button
          type="button"
          onClick={handlePause}
          aria-label="一時停止"
          className="rounded bg-yellow-400 px-3 py-1 text-white disabled:opacity-60"
          disabled={!player}
        >
          一時停止
        </button>
        <button
          type="button"
          onClick={handleStop}
          aria-label="停止"
          className="rounded bg-red-500 px-3 py-1 text-white disabled:opacity-60"
          disabled={!player}
        >
          停止
        </button>
        <div className="ml-auto text-sm text-gray-600">
          {formatTime(currentTime)}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">テンポ</label>
        <input
          type="range"
          min={40}
          max={220}
          value={localTempo}
          aria-label="テンポ"
          onChange={(e) => handleTempoChange(Number(e.target.value))}
          className="flex-1"
        />
        <div className="w-12 text-right text-sm">{localTempo} BPM</div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">ボリューム</label>
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
        <div className="w-12 text-right text-sm">
          {Math.round(volume * 100)}%
        </div>
      </div>
    </div>
  )
}

function formatTime(t: number) {
  const sec = Math.max(0, Math.floor(t))
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
