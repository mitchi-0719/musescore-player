'use client'

import { useEffect } from 'react'

import {
  initPlayerFromMusicXml,
  initPlayerFromOsmd,
} from '@/hooks/useAudioPlayer'
import { useScoreStore } from '@/stores/useScoreStore'

import PlayerControls from './PlayerControls'

type Props = { osmdRef?: { current: any } }

export default function AudioPlayer({ osmdRef }: Props) {
  const musicXml = useScoreStore((s) => s.musicXml)
  const player = useScoreStore((s) => s.player)
  const setPlayer = useScoreStore((s) => s.setPlayer)
  const setCurrentTime = useScoreStore((s) => s.setCurrentTime)
  const setIsPlaying = useScoreStore((s) => s.setIsPlaying)

  useEffect(() => {
    let mounted = true

    let unsubscribe: (() => void) | undefined

    const setup = async () => {
      if (!musicXml) return
      try {
        const p =
          osmdRef && osmdRef.current
            ? await initPlayerFromOsmd(osmdRef.current)
            : await initPlayerFromMusicXml(musicXml)
        if (!mounted) return

        unsubscribe = p.onTimeUpdate((t) => {
          setCurrentTime(t)
        })

        // wrap play/pause to set store state
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

        setPlayer(p)
      } catch (err) {
        console.error('player init error', err)
      }
    }

    setup()

    return () => {
      mounted = false
      try {
        if (unsubscribe) unsubscribe()
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
