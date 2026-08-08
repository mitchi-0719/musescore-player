import { FileUploader } from '../components/FileUploader'
import { ScorePreview } from '../components/ScorePreview'
import { Header } from '../components/layout/Header'
import { useScoreStore } from '../stores/useScoreStore'

export const PlayerPage = () => {
  const fileName = useScoreStore((state) => state.fileName)
  const musicXml = useScoreStore((state) => state.musicXml)
  const isLoading = useScoreStore((state) => state.isLoading)
  const hasScore = Boolean(fileName && musicXml && !isLoading)

  return (
    <div className="flex min-h-screen flex-col bg-[#f8faff] text-[#071b47]">
      <Header hasScore={hasScore} />
      <main
        className={hasScore ? 'flex-1 bg-white' : 'mx-auto w-full max-w-5xl'}
      >
        {hasScore ? <ScorePreview /> : <FileUploader />}
      </main>
    </div>
  )
}
