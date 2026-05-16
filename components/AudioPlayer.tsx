'use client'

import { useEffect } from 'react'

import useAudioPlayer, { initPlayer } from '@/hooks/useAudioPlayer'
import { useScoreStore } from '@/stores/useScoreStore'

import PlayerControls from './PlayerControls'

type Props = {}

export default function AudioPlayer(_props: Props) {
  const musicXml = useScoreStore((s) => s.musicXml)
  const player = useScoreStore((s) => s.player)
  const setPlayer = useScoreStore((s) => s.setPlayer)
  const setCurrentTime = useScoreStore((s) => s.setCurrentTime)
  const setIsPlaying = useScoreStore((s) => s.setIsPlaying)

  useEffect(() => {
    let mounted = true

    const setup = async () => {
      if (!musicXml) return
      try {
        const p = await initPlayer({ tempo: 120 })
        if (!mounted) return
        setPlayer(p)
        // subscribe time updates
        const off = p.onTimeUpdate((t) => {
          setCurrentTime(t)
        })
        // store playing state when play/pause called
        // simple heuristic: wrap play/pause to set store
        const origPlay = p.play.bind(p)
        p.play = async () => {
          await origPlay()
          setIsPlaying(true)
        }
        const origPause = p.pause.bind(p)
        p.pause = () => {
          origPause()
          setIsPlaying(false)
        }
        // attach back
        setPlayer(p)
        // cleanup when component unmounts is handled below
      } catch (err) {
        console.error('player init error', err)
      }
    }

    setup()

    return () => {
      mounted = false
      try {
        player?.dispose()
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
