'use client'

import { useEffect } from 'react'

import { initPlayer } from '@/hooks/useAudioPlayer'
import { useScoreStore } from '@/stores/useScoreStore'

import { PlayerControls } from './PlayerControls'

type Props = {}

export const AudioPlayer = (_props: Props) => {
  const musicXml = useScoreStore((s) => s.musicXml)
  const player = useScoreStore((s) => s.player)
  const setPlayer = useScoreStore((s) => s.setPlayer)
  const setCurrentTime = useScoreStore((s) => s.setCurrentTime)
  const setIsPlaying = useScoreStore((s) => s.setIsPlaying)

  useEffect(() => {
    let mounted = true

    let unsubscribe: (() => void) | undefined
    let patched = false

    const setup = async () => {
      if (!musicXml) return
      try {
        const p = await initPlayer({ tempo: 120 })
        if (!mounted) return

        // subscribe time updates
        unsubscribe = p.onTimeUpdate((t) => {
          setCurrentTime(t)
        })

        // store playing state when play/pause called
        // simple heuristic: wrap play/pause to set store
        const origPlay = p.play.bind(p)
        const origPause = p.pause.bind(p)
        p.play = async () => {
          await origPlay()
          setIsPlaying(true)
        }
        p.pause = () => {
          origPause()
          setIsPlaying(false)
        }

        // publish player to store once (avoid duplicate sets)
        setPlayer(p)
        patched = true
      } catch (err) {
        console.error('player init error', err)
      }
    }

    setup()

    return () => {
      mounted = false
      try {
        // unsubscribe time updates
        if (unsubscribe) unsubscribe()
        // dispose latest player from store (if any)
        const current = useScoreStore.getState().player
        current?.dispose()
        setPlayer(null)
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXml])

  if (!musicXml) return null

  return (
    <div className="mt-4">
      <PlayerControls />
    </div>
  )
}
