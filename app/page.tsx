'use client'

import FileUploader from '@/components/FileUploader'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          MuseScore Player
        </h1>
        <p className="mb-8 text-gray-600">
          MSCZ ファイルを読み込んで、MusicXML に変換します
        </p>
        <FileUploader />
      </div>
    </main>
  )
}
