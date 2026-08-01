import { FileUploader } from '../components/FileUploader'
import { ScorePreview } from '../components/ScorePreview'
import { Header } from '../components/layout/Header'

export const PlayerPage = () => (
  <div className="flex min-h-screen flex-col bg-linear-to-br from-blue-50 to-indigo-100">
    <Header />
    <main className="flex flex-col items-center justify-center">
      <ScorePreview />
      <FileUploader />
    </main>
  </div>
)
