/**
 * webmscore (WASM) のラッパー
 * .mscz ファイルを MusicXML に変換する
 */

// グローバル WebMscore の型定義
interface WebMscoreLib {
  ready: Promise<void>
  load: (
    format: 'mscz' | 'mscx' | 'musicxml',
    data: Uint8Array,
    fonts?: Uint8Array[],
    doLayout?: boolean
  ) => Promise<WebMscoreInstance>
}

interface WebMscoreInstance {
  saveXml: () => Promise<string>
  metadata: () => Promise<any>
}

declare global {
  interface Window {
    WebMscore?: WebMscoreLib
  }
}

/**
 * WebMscore グローバルオブジェクトが利用可能になるまで待機
 */
async function getWebMscore(): Promise<WebMscoreLib> {
  // ブラウザ環境であることを確認
  if (typeof window === 'undefined') {
    throw new Error('この機能はブラウザ環境でのみ動作します')
  }

  // WebMscore が既に読み込まれているか確認
  if (window.WebMscore) {
    try {
      await window.WebMscore.ready
      return window.WebMscore
    } catch (err) {
      console.error('WebMscore の初期化に失敗しました:', err)
      throw new Error(
        'webmscore モジュールの初期化に失敗しました。再度お試しください。'
      )
    }
  }

  // 最大60秒待機
  const startTime = Date.now()
  const timeout = 60000

  while (Date.now() - startTime < timeout) {
    if (window.WebMscore) {
      try {
        await window.WebMscore.ready
        return window.WebMscore
      } catch (err) {
        console.error('WebMscore の初期化に失敗しました:', err)
        throw new Error(
          'webmscore モジュールの初期化に失敗しました。再度お試しください。'
        )
      }
    }

    // 100ms 待機してリトライ
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(
    'webmscore モジュールの読み込みがタイムアウトしました。インターネット接続を確認してください。'
  )
}

/**
 * MSCZ ファイルを MusicXML に変換
 * @param fileBinary MSCZ ファイルのバイナリ
 * @returns MusicXML 文字列
 */
export async function convertMsczToMusicXml(
  fileBinary: Uint8Array
): Promise<string> {
  try {
    // WebMscore を取得
    const WebMscore = await getWebMscore()

    console.log(
      `楽譜ファイルを読み込み中... (${(fileBinary.length / 1024).toFixed(1)} KB)`
    )

    // MSCZ ファイルをロード（doLayout = true で描画も含める）
    const score = await WebMscore.load('mscz', fileBinary, undefined, true)

    if (!score) {
      throw new Error('スコアオブジェクトの作成に失敗しました')
    }

    // メタデータを取得（デバッグ用）
    const metadata = await score.metadata()
    console.log('楽譜メタデータ:', metadata)

    // MusicXML を生成
    console.log('MusicXML に変換中...')
    const musicXml = await score.saveXml()

    if (!musicXml || typeof musicXml !== 'string') {
      throw new Error('MusicXML の生成に失敗しました')
    }

    console.log(
      `変換完了: MusicXML (${(musicXml.length / 1024).toFixed(1)} KB)`
    )
    return musicXml
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '不明なエラーが発生しました'
    console.error('MSCZ 変換エラー:', message)
    console.error('エラースタック:', err)

    // ユーザーフレンドリーなエラーメッセージ
    if (
      message.includes('Invalid') ||
      message.includes('parse') ||
      message.includes('corrupt') ||
      message.includes('不正') ||
      message.includes('Bad') ||
      message.includes('format')
    ) {
      throw new Error(
        'ファイルが破損しているか、対応していない形式です。別の MSCZ ファイルをお試しください。'
      )
    }

    if (
      message.includes('memory') ||
      message.includes('allocation') ||
      message.includes('out of memory')
    ) {
      throw new Error(
        '楽譜ファイルが大きすぎます。より小さいファイルをお試しください。'
      )
    }

    if (
      message.includes('タイムアウト') ||
      message.includes('timeout') ||
      message.includes('Timeout')
    ) {
      throw new Error(
        'webmscore モジュールの読み込みに時間がかかっています。インターネット接続を確認してください。'
      )
    }

    if (
      message.includes('postMessage') ||
      message.includes('Worker') ||
      message.includes('WebAssembly')
    ) {
      throw new Error(
        'webmscore モジュールの初期化に失敗しました。ページをリロードしてからお試しください。'
      )
    }

    throw new Error(`楽譜の解析に失敗しました: ${message}`)
  }
}
