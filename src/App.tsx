import { FileUploader } from "./components/FileUploader";
import { Header } from "./components/layout/Header";
import { ScorePreview } from "./components/ScorePreview";

export const App = () => {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-blue-50 to-indigo-100">
      <Header />
      <main className="flex flex-col items-center justify-center">
        <ScorePreview />
        <FileUploader />
      </main>
    </div>
  )
}
