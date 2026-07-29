import { useEffect, useRef, useState } from 'react'

import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

import { waitFrame } from '../lib/waitFrame'

// 楽譜を初回表示する際の拡大率。必要に応じてここを調整する。
export const DEFAULT_SCORE_ZOOM = 0.35

export const useOSMD = (
  musicXml: string | null,
  musicMxl: Uint8Array | null = null,
  zoom = DEFAULT_SCORE_ZOOM
) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const zoomRef = useRef(zoom)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    let lastWidth = window.innerWidth
    let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null

    const handleWindowResize = () => {
      const currentWidth = window.innerWidth
      const currentHeight = window.innerHeight

      // 幅が変化した場合のみ処理を実行
      if (currentWidth !== lastWidth) {
        console.log(
          '[useOSMD] Width changed from',
          lastWidth,
          'to',
          currentWidth,
          '- Debouncing resize...'
        )
        lastWidth = currentWidth

        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId)
        }

        resizeTimeoutId = setTimeout(() => {
          if (osmdRef.current) {
            console.log(
              '[useOSMD] Executing manual resize and render due to width change'
            )
            try {
              osmdRef.current.render()
            } catch (err) {
              console.error('[useOSMD] Manual resize render error:', err)
            }
          }
        }, 300)
      } else {
        console.log('[useOSMD] Ignored height change', {
          width: currentWidth,
          height: currentHeight,
        })
      }
    }

    window.addEventListener('resize', handleWindowResize)
    return () => {
      window.removeEventListener('resize', handleWindowResize)
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId)
      }
    }
  }, [])

  useEffect(() => {
    console.log('[useOSMD] useEffect triggered', {
      hasMusicXml: !!musicXml,
      hasMusicMxl: !!musicMxl,
    })
    const container = containerRef.current
    if ((!musicXml && !musicMxl) || !container) {
      console.log(
        '[useOSMD] Skipping setup - missing music source or container'
      )
      setIsRendering(false)
      return
    }

    let isCancelled = false

    const setup = async () => {
      console.log('[useOSMD] setup starting...')
      try {
        setRenderError(null)
        setIsRendering(true)

        await waitFrame()
        await waitFrame()

        if (isCancelled || !container) {
          console.log('[useOSMD] setup cancelled before OSMD initialization')
          return
        }

        console.log('[useOSMD] Initializing OpenSheetMusicDisplay')
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        if (isCancelled) return

        const osmd = new OpenSheetMusicDisplay(container, {
          autoResize: false, // 画面サイズ変更時の自動リサイズをオフ（幅変更のみ自前で制御するため）
          backend: 'svg', // デモと同じくっきりしたSVG描画
          drawTitle: true, // タイトルを描画する
          drawSubtitle: true, // サブタイトルを描画する
          drawingParameters: 'default', // デモ標準の美しいレイアウト
          disableCursor: false, // 必須：Tone.jsと同期する縦棒（カーソル）を使うため
        })

        osmdRef.current = osmd

        if (musicXml) {
          console.log('[useOSMD] Loading musicXml string')
          await osmd.load(musicXml)
        } else if (musicMxl) {
          console.log('[useOSMD] Loading musicMxl blob')
          const arrayBuffer = new Uint8Array(musicMxl).buffer
          await osmd.load(
            new Blob([arrayBuffer], {
              type: 'application/vnd.recordare.musicxml',
            })
          )
        } else {
          return
        }

        // 描画準備中に変更された倍率も、初回描画に反映する。
        osmd.zoom = zoomRef.current

        if (!isCancelled) {
          console.log('[useOSMD] Calling osmd.render()')
          osmd.render()
          setIsRendering(false)
        } else {
          console.log('[useOSMD] Render cancelled before rendering')
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
      console.log('[useOSMD] useEffect cleanup - clearing OSMD')
      isCancelled = true
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
