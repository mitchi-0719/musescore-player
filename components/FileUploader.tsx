'use client'

import { useCallback, useRef, useState } from 'react'

import { convertMsczToMusicXml } from '@/lib/webmscore'
import { useScoreStore } from '@/stores/useScoreStore'

import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

export default function FileUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    setFileBinary,
    setLoading,
    setError,
    setMusicXml,
    error,
    isLoading,
    fileName,
    musicXml,
    reset,
  } = useScoreStore()

  const hasLoadedScore = Boolean(fileName && musicXml && !isLoading)

  /**
   * ファイルを処理（MSCZ → MusicXML 変換）
   */
  const processFile = useCallback(
    async (file: File) => {
      try {
        // ファイル形式の検証
        const validExtensions = ['.mscz', '.mxl', '.xml']
        const fileName = file.name.toLowerCase()
        const isValid = validExtensions.some((ext) => fileName.endsWith(ext))

        if (!isValid) {
          setError(
            `対応していないファイル形式です。MSCZ, MXL, XML ファイルをお選びください。`
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
        const musicXml = await convertMsczToMusicXml(binary)

        // 結果を格納
        setMusicXml(musicXml)
        setLoading(false)

        console.log(
          `✅ ファイル処理完了: ${file.name} → MusicXML (${(musicXml.length / 1024).toFixed(1)} KB)`
        )
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '不明なエラーが発生しました'
        console.error('ファイル処理エラー:', message)
        setError(message)
        setLoading(false)
      }
    },
    [setFileBinary, setLoading, setError, setMusicXml]
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

      console.log('✅ demo.mscz の処理完了')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '不明なエラーが発生しました'
      console.error('demo.mscz 処理エラー:', message)
      setError(message)
    }
  }, [processFile, setError])

  const handleResetScore = useCallback(() => {
    reset()
    setIsDragging(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [reset])

  return (
    <div className="space-y-6">
      {!hasLoadedScore ? (
        <>
          {/* ドラッグ&ドロップエリア */}
          <div
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
              accept=".mscz,.mxl,.xml"
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

          {/* demo.mscz 読み込みボタン */}
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
      ) : (
        <Alert variant="success">
          <AlertTitle>
            読み込みが完了しました。(ファイル名: {fileName})
          </AlertTitle>
          <AlertDescription>
            ファイルを削除すると、別のファイルを選択できます。
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="error">
          <AlertTitle>エラーが発生しました</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && !error && (
        <Alert variant="info">
          <AlertTitle>処理中...</AlertTitle>
          <AlertDescription>
            楽譜ファイルを読み込んで MusicXML に変換しています
          </AlertDescription>
        </Alert>
      )}

      {hasLoadedScore && (
        <button
          onClick={handleResetScore}
          className="w-full rounded-lg border border-red-300 px-4 py-3 font-medium text-red-700 transition-colors hover:bg-red-50"
        >
          ファイルを削除
        </button>
      )}
    </div>
  )
}
