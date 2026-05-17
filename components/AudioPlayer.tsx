'use client'

import { useEffect } from 'react'

import { initPlayerFromOsmd } from '@/hooks/useAudioPlayer'
import { useScoreStore } from '@/stores/useScoreStore'

import PlayerControls from './PlayerControls'

type Props = { osmdRef?: { current: any } }

export default function AudioPlayer({ osmdRef }: Props) {
  const player = useScoreStore((s) => s.player)
  const setPlayer = useScoreStore((s) => s.setPlayer)
  const setCurrentTime = useScoreStore((s) => s.setCurrentTime)
  const setIsPlaying = useScoreStore((s) => s.setIsPlaying)
  const setError = useScoreStore((s) => s.setError)

  useEffect(() => {
    let mounted = true

    let unsubscribe: (() => void) | undefined

    const setup = async () => {
      if (!osmdRef?.current || !osmdRef.current.sheet) return
      try {
        const p = await initPlayerFromOsmd(osmdRef.current)

        if (!mounted) return

        unsubscribe = p.onTimeUpdate((t) => {
          setCurrentTime(t)
        })

        // wrap play/pause to set store state
        const origPlay = p.play.bind(p)
        const origPause = p.pause.bind(p)
        p.play = async () => {
          try {
            await origPlay()
            setIsPlaying(true)
          } catch (err) {
            const msg =
              err instanceof Error
                ? err.message
                : '再生に失敗しました。もう一度お試しください。'
            setError(msg)
            setIsPlaying(false)
            throw err
          }
        }
        p.pause = () => {
          origPause()
          setIsPlaying(false)
        }

        setPlayer(p)
      } catch (err) {
        if (mounted) {
          const msg =
            err instanceof Error
              ? err.message
              : '音声再生の初期化に失敗しました'
          console.error('player init error', err)
          setError(msg)
        }
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
      } catch (e) {
        console.warn('Cleanup error:', e)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osmdRef])

  if (!osmdRef?.current) return null

  return (
    <div className="mt-4">
      <PlayerControls />
    </div>
  )
}
