import { useEffect, useMemo } from 'react'

import * as Tone from 'tone'
import { useShallow } from 'zustand/shallow'

import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useNoteInteraction } from '../hooks/useNoteInteraction'
import { useOSMD } from '../hooks/useOSMD'
import {
  type ParsedMusicData,
  parseMusicXmlForEvents,
} from '../lib/musicXmlParser'
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

  const parsedData = useMemo((): ParsedMusicData => {
    if (!musicXml) return { events: [], tempo: 120 }
    return parseMusicXmlForEvents(musicXml)
  }, [musicXml])

  const parsedEvents = parsedData.events

  // Transport BPM を楽譜のテンポに同期
  useEffect(() => {
    Tone.getTransport().bpm.value = parsedData.tempo
  }, [parsedData.tempo])

  const { play, stop, playNote } = useAudioPlayer(osmdRef, parsedEvents)

  const { handleScoreClick } = useNoteInteraction(
    containerRef,
    osmdRef,
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
        <div
          className="overflow-x-auto rounded-lg bg-white"
          style={{ contain: 'layout style' }}
        >
          <div
            ref={containerRef}
            className="relative w-full bg-white"
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
