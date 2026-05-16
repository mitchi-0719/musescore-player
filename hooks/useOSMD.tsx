import { useEffect, useRef, useState } from 'react'

import { waitFrame } from '@/lib/waitFrame'

type OSMDInstance = import('opensheetmusicdisplay').OpenSheetMusicDisplay

// 楽譜のXMLを渡すと、描画先のRefとエラー状態だけを返してくれるフック
export const useOSMD = (musicXml: string | null) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    if (!musicXml || !containerRef.current) return
    let isCancelled = false
    const osmdRef = { current: null as OSMDInstance | null }

    const setup = async () => {
      try {
        setRenderError(null)
        await waitFrame()
        await waitFrame()

        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        if (isCancelled || !containerRef.current) return

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
        })
        osmdRef.current = osmd
        await osmd.load(musicXml)
        if (!isCancelled) osmd.render()
      } catch (err) {
        setRenderError('描画エラーが発生しました')
      }
    }

    setup()
    return () => {
      isCancelled = true
      osmdRef.current?.clear()
    }
  }, [musicXml])

  return { containerRef, renderError }
}
