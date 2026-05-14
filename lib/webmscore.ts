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
  setLogLevel?: (level: number) => Promise<void>
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

    // 詳細ログを有効化（worker 内のログレベルを上げる）
    try {
      await WebMscore.setLogLevel?.(3)
    } catch (e) {
      console.warn('setLogLevel が利用できません:', e)
    }

    console.log(
      `楽譜ファイルを読み込み中... (${(fileBinary.length / 1024).toFixed(1)} KB)`
    )

    // MSCZ ファイルをロード（doLayout = true で描画も含める）
    // Worker に渡す際、Transferable として安全な ArrayBuffer を渡す。
    const arrayBuffer = fileBinary.buffer.slice(
      fileBinary.byteOffset,
      fileBinary.byteOffset + fileBinary.byteLength
    )
    const uint8 = new Uint8Array(arrayBuffer)
    // コピーは各試行の直前に作成する（transfer により ArrayBuffer が切り離されるため）

    // fonts は未指定より空配列で明示的に渡す（structured clone 周りの問題回避）
    // まず doLayout=true で試し、失敗した場合は段階的にフォールバックする
    function hexHead(ua: Uint8Array, n = 8) {
      return Array.from(ua.slice(0, n))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
    }

    console.log(
      'convertMsczToMusicXml: bytes=',
      uint8.length,
      'head=',
      hexHead(uint8, 12)
    )

    let score

    // 試行1: Uint8Array, doLayout=true
    try {
      console.log('WebMscore: trying load as Uint8Array (doLayout=true)')
      const firstTry = new Uint8Array(uint8.length)
      firstTry.set(uint8)
      score = await WebMscore.load('mscz', firstTry, [], true)
    } catch (firstErr) {
      console.warn('WebMscore load (doLayout=true) failed:', firstErr)

      // 試行2: Uint8Array, doLayout=false
      try {
        console.log('WebMscore: retry load as Uint8Array (doLayout=false)')
        const fallbackTry = new Uint8Array(uint8.length)
        fallbackTry.set(uint8)
        score = await WebMscore.load('mscz', fallbackTry, [], false)
      } catch (secondErr) {
        console.warn('WebMscore load (doLayout=false) failed:', secondErr)

        // 試行3: ArrayBuffer を渡してみる（ライブラリが ArrayBuffer を期待している可能性を検証）
        try {
          console.log(
            'WebMscore: final retry load as ArrayBuffer (doLayout=false)'
          )
          // fresh copy from original uint8
          const tmp = new Uint8Array(uint8.length)
          tmp.set(uint8)
          // @ts-ignore - 一部実装は ArrayBuffer を受け付ける
          score = await WebMscore.load('mscz', tmp, [], false)
        } catch (thirdErr) {
          console.error('All WebMscore load attempts failed', {
            firstErr,
            secondErr,
            thirdErr,
          })
          throw thirdErr
        }
      }
    }

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
