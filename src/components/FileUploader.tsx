import { useCallback, useRef, useState } from 'react'

import { convertMsczToMusicXml } from '../lib/msczConverter'
import { useScoreStore } from '../stores/useScoreStore'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

export const FileUploader = () => {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setFileBinary = useScoreStore((s) => s.setFileBinary)
  const setLoading = useScoreStore((s) => s.setLoading)
  const setError = useScoreStore((s) => s.setError)
  const setMusicXml = useScoreStore((s) => s.setMusicXml)
  const setMusicMxl = useScoreStore((s) => s.setMusicMxl)
  const error = useScoreStore((s) => s.error)
  const isLoading = useScoreStore((s) => s.isLoading)
  const fileName = useScoreStore((s) => s.fileName)
  const musicXml = useScoreStore((s) => s.musicXml)

  const hasLoadedScore = Boolean(fileName && musicXml && !isLoading)

  /**
   * ファイルを処理（MSCZ → MusicXML 変換）
   */
  const processFile = useCallback(
    async (file: File) => {
      try {
        // ファイル形式の検証
        const validExtensions = ['.mscz']
        const fileName = file.name.toLowerCase()
        const isValid = validExtensions.some((ext) => fileName.endsWith(ext))

        if (!isValid) {
          setError(
            `対応していないファイル形式です。MSCZ ファイルをお選びください。`
          )
          return
        }

        // ファイルサイズの検証（100 MB まで）
        const maxSize = 100 * 1024 * 1024
        if (file.size > maxSize) {
          setError(
            `ファイルサイズが大きすぎます。100 MB 以下のファイルをお選びください。`
          )
          return
        }

        setLoading(true)
        setError(null)

        // ファイルをバイナリとして読み込み
        const arrayBuffer = await file.arrayBuffer()
        const binary = new Uint8Array(arrayBuffer)

        // Zustand ストアに格納
        setFileBinary(binary, file.name)

        // webmscore で MusicXML に変換
        const { musicXml, musicMxl } = await convertMsczToMusicXml(binary)

        // 結果を格納
        setMusicXml(musicXml)
        setMusicMxl(musicMxl)
        setLoading(false)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '不明なエラーが発生しました'
        console.error('ファイル処理エラー:', message)
        setError(message)
        setLoading(false)
      }
    },
    [setFileBinary, setLoading, setError, setMusicXml, setMusicMxl]
  )

  /**
   * ファイル入力の変更を処理
   */
  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        processFile(file)
      }
    },
    [processFile]
  )

  /**
   * ドラッグ&ドロップを処理
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files?.[0]
      if (file) {
        processFile(file)
      }
    },
    [processFile]
  )

  /**
   * demo.mscz を読み込み
   */
  const loadDemoFile = useCallback(async () => {
    try {
      // public/demo.mscz を読み込み
      const response = await fetch('/demo.mscz')
      if (!response.ok) {
        throw new Error(
          `demo.mscz の読み込みに失敗しました (${response.status})`
        )
      }

      const arrayBuffer = await response.arrayBuffer()
      const demoFile = new File([arrayBuffer], 'demo.mscz', {
        type: 'application/octet-stream',
      })

      await processFile(demoFile)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '不明なエラーが発生しました'
      console.error('demo.mscz 処理エラー:', message)
      setError(message)
    }
  }, [processFile, setError])

  return (
    <section className="mt-12 w-full max-w-2xl space-y-6 rounded-lg bg-white p-4 shadow-lg">
      {!hasLoadedScore && !isLoading && (
        <>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click()
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed px-8 py-12 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mscz"
              onChange={handleFileInput}
              disabled={isLoading}
              className="hidden"
            />

            <div className="space-y-4">
              <div className="text-4xl">🎵</div>
              <div>
                <p className="text-lg font-semibold text-gray-700">
                  MSCZ ファイルをドラッグ&ドロップ
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  または以下をクリックして選択
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="inline-block rounded-lg bg-blue-500 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:bg-gray-400"
              >
                {isLoading ? '処理中...' : 'ファイルを選択'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-300" />
            <span className="text-sm text-gray-500">または</span>
            <div className="flex-1 border-t border-gray-300" />
          </div>

          <button
            onClick={loadDemoFile}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:bg-gray-100"
          >
            {isLoading ? '処理中...' : 'デモ楽譜を読み込み'}
          </button>
        </>
      )}

      {error && (
        <Alert variant="error">
          <AlertTitle>エラーが発生しました</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}
