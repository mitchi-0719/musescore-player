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
        <Script id="patch-webmscore" strategy="afterInteractive">
          {`(function(){
            function wrap(){
              if(!window.WebMscore){
                setTimeout(wrap,100);
                return;
              }
              try{
                const orig = window.WebMscore.load;
                window.WebMscore.load = async function(format,data,fonts,doLayout){
                  try{
                    const t = data && data.constructor ? data.constructor.name : typeof data;
                    const len = data && data.length;
                    let head = '';
                    try{ head = data && data.slice ? Array.from(data.slice(0,12)).map(b=>b.toString(16).padStart(2,'0')).join(' ') : ''; }catch(e){}
                    console.log('Patched WebMscore.load called. format=', format, 'dataType=', t, 'len=', len, 'head=', head, 'doLayout=', doLayout);
                  }catch(e){ console.warn('patch log failed', e); }
                  return orig.apply(this, arguments);
                }
              }catch(e){ console.warn('wrap failed', e); }
            }
            wrap();
          })()`}
        </Script>
      </body>
    </html>
  )
}
