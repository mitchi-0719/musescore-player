import { useEffect, useRef, useState } from 'react'

import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

import { waitFrame } from '../lib/waitFrame'

export const useOSMD = (
  musicXml: string | null,
  musicMxl: Uint8Array | null = null
) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if ((!musicXml && !musicMxl) || !container) {
      setIsRendering(false)
      return
    }

    let isCancelled = false
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null

    // 画面リサイズ時に楽譜を再描画（300ms デバウンス）
    // autoResize: true を使わず手動で制御することで、
    // モバイルのアドレスバー表示/非表示によるスクロール中の不要な再描画を防止
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (!isCancelled && osmdRef.current) {
          osmdRef.current.render()
        }
      }, 300)
    }

    const setup = async () => {
      try {
        setRenderError(null)
        setIsRendering(true)

        await waitFrame()
        await waitFrame()

        if (isCancelled || !container) return

        const osmd = new OpenSheetMusicDisplay(container, {
          autoResize: false, // 手動でデバウンスしたリサイズ処理を使用
          backend: 'svg',
          drawTitle: true,
          drawSubtitle: true,
          drawingParameters: 'default',
          disableCursor: false,
        })

        osmdRef.current = osmd

        if (musicMxl) {
          const arrayBuffer = new Uint8Array(musicMxl).buffer
          await osmd.load(
            new Blob([arrayBuffer], {
              type: 'application/vnd.recordare.musicxml',
            })
          )
        } else if (musicXml) {
          await osmd.load(musicXml)
        } else {
          return
        }

        osmd.zoom = 0.4

        if (!isCancelled) {
          osmd.render()
          setIsRendering(false)

          // 初回描画完了後にリサイズリスナーを登録
          window.addEventListener('resize', handleResize)
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('OSMD Render Error:', err)
          setRenderError('楽譜の描画中にエラーが発生しました')
          setIsRendering(false)
        }
      }
    }

    setup()

    return () => {
      isCancelled = true
      window.removeEventListener('resize', handleResize)
      if (resizeTimeout) clearTimeout(resizeTimeout)
      if (osmdRef.current) {
        osmdRef.current.clear()
        osmdRef.current = null
      }
      if (container) {
        container.innerHTML = ''
      }
    }
  }, [musicXml, musicMxl])

  return { containerRef, renderError, isRendering, osmdRef }
}
