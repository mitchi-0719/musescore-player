import { useEffect, useRef, useState } from 'react'

import { waitFrame } from '@/lib/waitFrame'

type OSMDInstance = import('opensheetmusicdisplay').OpenSheetMusicDisplay

// 楽譜のXMLを渡すと、描画先のRefとエラー状態、描画中状態を返すフック
export const useOSMD = (musicXml: string | null) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)

  useEffect(() => {
    if (!musicXml || !containerRef.current) {
      setIsRendering(false)
      return
    }

    let isCancelled = false
    const osmdRef = { current: null as OSMDInstance | null }

    const setup = async () => {
      try {
        setRenderError(null)
        setIsRendering(true)
        await waitFrame()
        await waitFrame()

        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        if (isCancelled || !containerRef.current) return

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
        })
        osmdRef.current = osmd
        await osmd.load(musicXml)
        osmd.zoom = 0.4
        if (!isCancelled) {
          osmd.render()
          setIsRendering(false)
        }
      } catch (err) {
        if (!isCancelled) {
          setRenderError('描画エラーが発生しました')
          setIsRendering(false)
        }
      }
    }

    setup()
    return () => {
      isCancelled = true
      osmdRef.current?.clear()
    }
  }, [musicXml])

  return { containerRef, renderError, isRendering }
}
