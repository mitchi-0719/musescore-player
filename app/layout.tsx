import { ReactNode } from 'react'

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Script
          src="https://cdn.jsdelivr.net/npm/webmscore@1.2.1/webmscore.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  )
}
