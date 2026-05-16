'use client'

import { useRef } from 'react'

import { type PlayerHandle, useScoreStore } from '@/stores/useScoreStore'

// シンプルなプレイヤー実装（MVP）
// - AudioContext を使ってテンポに合わせたクリック音を再生
// - 内部タイマーで currentTime を更新し、onTimeUpdate コールバックを呼び出す

class SimplePlayer implements PlayerHandle {
  private audioCtx: AudioContext | null = null
  private tempo: number
  private volume: number
  private isPlayingFlag = false
  private startTs = 0 // performance.now() start
  private offset = 0 // seconds
  private rafId: number | null = null
  private callbacks: Set<(t: number) => void> = new Set()

  constructor({ tempo = 120, volume = 1 } = {}) {
    this.tempo = tempo
    this.volume = volume
    try {
      this.audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )()
    } catch (e) {
      this.audioCtx = null
    }
  }

  async play() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume()
    }
    if (!this.isPlayingFlag) {
      this.isPlayingFlag = true
      this.startTs = performance.now() / 1000
      this.scheduleLoop()
    }
  }

  pause() {
    this.isPlayingFlag = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend().catch(() => {})
    }
  }

  seek(time: number) {
    this.offset = time
    this.startTs = performance.now() / 1000
    // Immediately notify callbacks of new time
    this.emitTime(time)
  }

  setTempo(bpm: number) {
    this.tempo = bpm
  }

  getCurrentTime() {
    if (!this.isPlayingFlag) return this.offset
    const now = performance.now() / 1000
    return this.offset + (now - this.startTs)
  }

  onTimeUpdate(cb: (t: number) => void) {
    this.callbacks.add(cb)
    // return unsubscribe
    return () => this.callbacks.delete(cb)
  }

  dispose() {
    this.pause()
    if (this.audioCtx) {
      try {
        this.audioCtx.close()
      } catch (e) {}
      this.audioCtx = null
    }
    this.callbacks.clear()
  }

  private emitTime(t: number) {
    this.callbacks.forEach((cb) => cb(t))
  }

  private scheduleLoop() {
    const loop = () => {
      const t = this.getCurrentTime()
      // click on quarter notes as simple audible feedback
      this.maybeClick(t)
      this.emitTime(t)
      if (this.isPlayingFlag) {
        this.rafId = requestAnimationFrame(loop)
      }
    }
    this.rafId = requestAnimationFrame(loop)
  }

  private lastClickBeat = -1
  private maybeClick(timeSec: number) {
    const beatInterval = 60 / this.tempo
    const beatIndex = Math.floor(timeSec / beatInterval)
    if (beatIndex !== this.lastClickBeat) {
      this.lastClickBeat = beatIndex
      this.playClick()
    }
  }

  private playClick() {
    if (!this.audioCtx) return
    const ctx = this.audioCtx
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 1000
    g.gain.value = 0
    o.connect(g)
    g.connect(ctx.destination)
    const now = ctx.currentTime
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(this.volume * 0.2, now + 0.001)
    g.gain.linearRampToValueAtTime(0, now + 0.05)
    o.start(now)
    o.stop(now + 0.06)
  }
}

export async function initPlayer(
  /** optional config */ config?: { tempo?: number; volume?: number }
): Promise<PlayerHandle> {
  const player = new SimplePlayer({
    tempo: config?.tempo ?? 120,
    volume: config?.volume ?? 1,
  })
  return player
}

export default function useAudioPlayer() {
  // helper hook for client components, returns init and dispose helpers
  const playerRef = useRef<PlayerHandle | null>(null)
  const setPlayer = useScoreStore((s) => s.setPlayer)
  return {
    async create(config?: { tempo?: number; volume?: number }) {
      const p = await initPlayer(config)
      playerRef.current = p
      setPlayer(p)
      return p
    },
    get player() {
      return playerRef.current
    },
    dispose() {
      playerRef.current?.dispose()
      playerRef.current = null
      setPlayer(null)
    },
  }
}
