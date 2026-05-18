import { ReactNode } from 'react'

import type { Metadata } from 'next'
import Script from 'next/script'

import './globals.css'

export const metadata: Metadata = {
  title: 'MuseScore Player',
  description: 'MSCZ ファイルをWASMで解析・再生する Web プレイヤー',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        {/* Verovio WASM ファイルのロード パス設定用のメタデータ */}
        <meta
          name="verovio-wasm-path"
          content="https://cdn.jsdelivr.net/npm/verovio@6.1.0/wasm/"
        />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Script
          src="https://cdn.jsdelivr.net/npm/webmscore@1.2.0/webmscore.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  )
}
