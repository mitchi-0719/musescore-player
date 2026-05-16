'use client'

import { FileUploader } from '@/components/FileUploader'
import { ScorePreview } from '@/components/ScorePreview'
import { Header } from '@/components/layout/Header'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-blue-50 to-indigo-100">
      <Header />
      <main className="flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl">
          <ScorePreview />
        </div>
        <div className="mt-8 w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg">
          <FileUploader />
        </div>
      </main>
    </div>
  )
}
