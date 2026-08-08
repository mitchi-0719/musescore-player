import { useCallback, useEffect, useRef, useState } from 'react'

import { convertMsczToMusicXml } from '../lib/msczConverter'
import {
  SCORE_CACHE_VERSION,
  SCORE_CONVERTER_VERSION,
  type ScoreHistoryItem,
  createScoreId,
  deleteCachedScore,
  getCachedScore,
  isCompatibleCachedScore,
  listRecentScores,
  saveCachedScore,
  touchCachedScore,
} from '../lib/scoreHistory'
import { useScoreStore } from '../stores/useScoreStore'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatOpenedAt = (timestamp: number) =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp)

export const FileUploader = () => {
  const [isDragging, setIsDragging] = useState(false)
  const [history, setHistory] = useState<ScoreHistoryItem[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setConvertedScore = useScoreStore((s) => s.setConvertedScore)
  const setLoading = useScoreStore((s) => s.setLoading)
  const setError = useScoreStore((s) => s.setError)
  const error = useScoreStore((s) => s.error)
  const isLoading = useScoreStore((s) => s.isLoading)
  const fileName = useScoreStore((s) => s.fileName)
  const musicXml = useScoreStore((s) => s.musicXml)

  const hasLoadedScore = Boolean(fileName && musicXml && !isLoading)
  const isHistoryBusy = restoringId !== null || deletingId !== null

  const refreshHistory = useCallback(async () => {
    setIsHistoryLoading(true)
    try {
      setHistory(await listRecentScores())
      setHistoryError(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '履歴を読み込めませんでした'
      setHistoryError(message)
    } finally {
      setIsHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void listRecentScores()
      .then((items) => {
        if (cancelled) return
        setHistory(items)
        setHistoryError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : '履歴を読み込めませんでした'
        setHistoryError(message)
      })
      .finally(() => {
        if (!cancelled) setIsHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  /**
   * ファイルを処理（MSCZ → MusicXML 変換）
   */
  const processFile = useCallback(
    async (file: File, saveToHistory = true) => {
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
        setStorageWarning(null)

        // ファイルをバイナリとして読み込み
        const arrayBuffer = await file.arrayBuffer()
        const binary = new Uint8Array(arrayBuffer)

        // webmscore で MusicXML に変換
        const { musicXml, musicMxl } = await convertMsczToMusicXml(binary)

        // 結果を一括で格納
        setConvertedScore({
          fileName: file.name,
          fileBinary: binary,
          musicXml,
          musicMxl,
        })

        if (saveToHistory) {
          try {
            const now = Date.now()
            const id = await createScoreId(binary)
            await saveCachedScore({
              id,
              fileName: file.name,
              fileSize: file.size,
              fileLastModified: file.lastModified,
              openedAt: now,
              createdAt: now,
              musicXml,
              musicMxl,
              cacheVersion: SCORE_CACHE_VERSION,
              converterVersion: SCORE_CONVERTER_VERSION,
            })
            await refreshHistory()
          } catch (historySaveError) {
            console.error('履歴保存エラー:', historySaveError)
            setStorageWarning(
              '楽譜は開けましたが、この端末に履歴を保存できませんでした。'
            )
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '不明なエラーが発生しました'
        console.error('ファイル処理エラー:', message)
        setError(message)
        setLoading(false)
      }
    },
    [refreshHistory, setConvertedScore, setLoading, setError]
  )

  const openFromHistory = useCallback(
    async (item: ScoreHistoryItem) => {
      if (isHistoryBusy || isLoading) return

      setRestoringId(item.id)
      setHistoryError(null)
      setStorageWarning(null)
      setLoading(true)

      try {
        if (!isCompatibleCachedScore(item)) {
          await deleteCachedScore(item.id)
          await refreshHistory()
          throw new Error(
            'この履歴は現在のバージョンでは開けません。MSCZファイルを再度選択してください。'
          )
        }

        const cachedScore = await getCachedScore(item.id)
        if (
          !cachedScore ||
          !isCompatibleCachedScore(cachedScore) ||
          typeof cachedScore.musicXml !== 'string' ||
          cachedScore.musicXml.length === 0
        ) {
          await deleteCachedScore(item.id)
          await refreshHistory()
          throw new Error(
            '履歴データを読み込めません。MSCZファイルを再度選択してください。'
          )
        }

        setConvertedScore({
          fileName: cachedScore.fileName,
          fileBinary: null,
          musicXml: cachedScore.musicXml,
          musicMxl: cachedScore.musicMxl,
        })

        try {
          await touchCachedScore(item.id)
          await refreshHistory()
        } catch (touchError) {
          console.error('履歴更新エラー:', touchError)
          setStorageWarning(
            '楽譜は開けましたが、履歴の最終利用日時を更新できませんでした。'
          )
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '履歴を読み込めませんでした'
        setHistoryError(message)
        setLoading(false)
      } finally {
        setRestoringId(null)
      }
    },
    [isHistoryBusy, isLoading, refreshHistory, setConvertedScore, setLoading]
  )

  const removeFromHistory = useCallback(
    async (item: ScoreHistoryItem) => {
      if (isHistoryBusy || isLoading) return
      if (!window.confirm(`「${item.fileName}」を履歴から削除しますか？`))
        return

      setDeletingId(item.id)
      setHistoryError(null)
      try {
        await deleteCachedScore(item.id)
        await refreshHistory()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '履歴を削除できませんでした'
        setHistoryError(message)
      } finally {
        setDeletingId(null)
      }
    },
    [isHistoryBusy, isLoading, refreshHistory]
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

      await processFile(demoFile, false)
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

          <div className="border-t border-gray-200 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                最近開いた楽譜
              </h2>
              {!isHistoryLoading && historyError && (
                <button
                  type="button"
                  onClick={() => void refreshHistory()}
                  disabled={isHistoryBusy}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                >
                  再読み込み
                </button>
              )}
            </div>

            {isHistoryLoading ? (
              <p className="text-sm text-gray-500">履歴を読み込んでいます...</p>
            ) : historyError ? (
              <Alert variant="error">
                <AlertTitle>履歴を読み込めませんでした</AlertTitle>
                <AlertDescription>{historyError}</AlertDescription>
              </Alert>
            ) : history.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
                まだ履歴はありません
              </p>
            ) : (
              <ul className="space-y-2">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">
                        {item.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(item.fileSize)}・
                        {formatOpenedAt(item.openedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openFromHistory(item)}
                      disabled={isHistoryBusy || isLoading}
                      className="rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:bg-gray-400"
                    >
                      {restoringId === item.id ? '読込中...' : '開く'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeFromHistory(item)}
                      disabled={isHistoryBusy || isLoading}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:text-gray-300"
                    >
                      {deletingId === item.id ? '削除中...' : '削除'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-xs text-gray-500">
              履歴はこの端末のブラウザ内だけに保存されます。ブラウザのデータを削除すると履歴も消去されます。
            </p>
          </div>
        </>
      )}

      {storageWarning && (
        <Alert variant="info">
          <AlertTitle>履歴を保存できませんでした</AlertTitle>
          <AlertDescription>{storageWarning}</AlertDescription>
        </Alert>
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
