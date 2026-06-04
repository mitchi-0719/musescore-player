# MuseScore Player

MuseScore の `.mscz` ファイルをブラウザ上で読み込み、**解析・楽譜表示・再生**までをフロントエンドのみで完結させる Web アプリです。

## 概要

- バックエンドを使わず、ブラウザ内で `.mscz` を処理
- 楽譜を SVG 描画して表示
- 音符タップ時の発音・再生/停止などの基本操作に対応
- `public/demo.mscz` を使ったデモ読み込みに対応

## 使用技術

- **フレームワーク / ビルド**: React 19, TypeScript, Vite
- **状態管理**: Zustand
- **楽譜解析**: webmscore（WASM）
- **楽譜描画**: OpenSheetMusicDisplay (OSMD)
- **再生**: Tone.js, osmd-audio-player
- **スタイリング**: Tailwind CSS
- **Lint / Format**: ESLint, Prettier

## アーキテクチャ

主な責務は以下のように分離しています。

- `src/components/`
  - `FileUploader`: `.mscz` ファイルの入力・バリデーション・デモ読み込み
  - `ScorePreview`: 楽譜表示、再生フック接続、音符クリック操作
  - `ControlModal`: 再生/停止 UI
- `src/hooks/`
  - `useOSMD`: OSMD インスタンス生成と描画
  - `useAudioPlayer`: サンプラー初期化、再生ループ、ノートトリガー
  - `useNoteInteraction`: クリック位置と楽譜ノートの対応付け
- `src/lib/`
  - `msczConverter`: `webmscore` で `.mscz` を MusicXML / MXL へ変換
  - `musicXmlParser`: MusicXML から再生イベント列を抽出
- `src/stores/useScoreStore.ts`
  - ファイル状態、変換結果、再生状態を一元管理

## 仕組み（処理フロー）

1. ユーザーが `.mscz` をアップロード（またはデモファイルを読み込み）
2. `webmscore` で MusicXML（必要に応じて MXL）へ変換
3. `useOSMD` が MusicXML を読み込み、楽譜を描画
4. `musicXmlParser` が MusicXML をノートイベントへ変換
5. `useAudioPlayer` が Tone.js でイベントを再生
6. `useNoteInteraction` がクリックされた音符を判定して単音再生

## セットアップ（初めての方向け）

### 1. 前提

- Node.js
- npm

### 2. インストール

```bash
npm ci
```

### 3. 開発サーバー起動

```bash
npm run dev
```

起動後、表示された URL（通常 `http://localhost:5173`）を開いてください。

### 4. 動作確認

1. 画面の「デモ楽譜を読み込み」をクリック  
   または `.mscz` ファイルをドラッグ&ドロップ
2. 楽譜が表示されることを確認
3. 再生ボタンで音が出ることを確認

## 開発用コマンド

```bash
# Lint
npm run lint

# Build
npm run build

# Format
npm run format

# Build済み成果物のプレビュー
npm run preview
```
