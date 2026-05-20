import { useMemo } from 'react'

import { useShallow } from 'zustand/shallow'

import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useNoteInteraction } from '../hooks/useNoteInteraction'
import { useOSMD } from '../hooks/useOSMD'
import { parseMusicXmlForEvents } from '../lib/musicXmlParser'
import { useScoreStore } from '../stores/useScoreStore'
import { ControlModal } from './ControlModal'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

export const ScorePreview = () => {
  const { musicXml, musicMxl, isLoading } = useScoreStore(
    useShallow((state) => ({
      musicXml: state.musicXml,
      musicMxl: state.musicMxl,
      isLoading: state.isLoading,
    }))
  )

  const { containerRef, renderError, isRendering, osmdRef } = useOSMD(
    musicXml,
    musicMxl
  )

  const parsedEvents = useMemo(() => {
    if (!musicXml) return []
    return parseMusicXmlForEvents(musicXml)
  }, [musicXml])

  const { play, stop, playNote } = useAudioPlayer(osmdRef, parsedEvents)

  const { handleScoreClick } = useNoteInteraction(
    containerRef,
    parsedEvents,
    playNote
  )

  const isLoadingScore = Boolean((isLoading || isRendering) && !musicXml)

  return (
    <section className="w-full">
      {renderError ? (
        <Alert variant="error">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{renderError}</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white">
          <div
            ref={containerRef}
            className="w-full"
            role="img"
            aria-label="楽譜表示エリア"
            onClick={handleScoreClick}
          />
          {isLoadingScore && (
            <Alert variant="info">
              <AlertTitle>処理中...</AlertTitle>
              <AlertDescription>
                楽譜ファイルを読み込んで MusicXML に変換しています
              </AlertDescription>
            </Alert>
          )}
          <ControlModal play={play} stop={stop} />
        </div>
      )}
    </section>
  )
}
