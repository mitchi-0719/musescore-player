import { useEffect, useRef, useState } from 'react'

import { waitFrame } from '@/lib/waitFrame'

type OSMDInstance = import('opensheetmusicdisplay').OpenSheetMusicDisplay

export const useOSMD = (
  musicXml: string | null,
  musicMxl: Uint8Array | null = null
) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const osmdRef = useRef<OSMDInstance | null>(null)

  useEffect(() => {
    if ((!musicXml && !musicMxl) || !containerRef.current) {
      setIsRendering(false)
      return
    }

    let isCancelled = false

    const setup = async () => {
      try {
        setRenderError(null)
        setIsRendering(true)

        await waitFrame()
        await waitFrame()

        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        if (isCancelled || !containerRef.current) return

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true, // 画面サイズ変更時に自動リサイズ
          backend: 'svg', // デモと同じくっきりしたSVG描画
          drawTitle: true, // タイトルを描画する
          drawSubtitle: true, // サブタイトルを描画する
          drawingParameters: 'default', // デモ標準の美しいレイアウト
          disableCursor: false, // 必須：Tone.jsと同期する縦棒（カーソル）を使うため
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
      if (osmdRef.current) {
        osmdRef.current.clear()
        osmdRef.current = null
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [musicXml, musicMxl])

  return { containerRef, renderError, isRendering, osmdRef }
}
