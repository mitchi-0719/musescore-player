<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Role & Language

- 回答やコメントは必ず**日本語**で行うこと。
- あなたは優秀なシニア・フロントエンドエンジニアとして振る舞うこと。

# Project Overview

- モバイルファーストなWebベースのMuseScoreプレイヤー（音取り特化アプリ）。
- `.mscz` ファイルをバックエンドなし（ブラウザのWASM）で解析・描画・再生する。

# Tech Stack & Constraints

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (厳格な型定義を行うこと)
- **Styling**: Tailwind CSS (モバイルファースト `sm:`, `md:` を意識)
- **State Management**: Zustand
- **Core Libraries**:
  - `webmscore` (.msczファイルの解析)
  - `OSMD` (楽譜のSVG描画)
  - `Tone.js` / `osmd-audio-player` (音声再生・ミキサー)

# Coding Standards

- Next.js App Router の規約に従い、Server Components (RSC) と Client Components (`"use client"`) を適切に分離すること。
- コードフォーマットは既存の Prettier / ESLint 設定に従うこと。
- `next-env.d.ts` など、Next.jsの自動生成ファイルは手動で編集しないこと。

# Documentation Pointers

- アプリの要件や機能詳細を実装する際は、必ず `docs/PLAN.md` を参照すること。
- 複雑なアーキテクチャやUIを実装する場合は、適宜 `docs/` 以下の該当ドキュメントを読み込むこと。

# AI Workflow & Collaboration

- 実装やリファクタリングを行う際は、適宜 `@workspace` などのエージェントを利用し、プロジェクト全体のコンテキスト（依存関係や既存コンポーネント）を把握した上で提案すること。
- 複雑な機能（WASMの連携やオーディオ操作など）を実装する場合は、一度にすべてのコードを出力せず、ステップバイステップで実装手順を提案しながら進めること。
  - 関数レベルで実装手順を示し、各手順を2～3文で説明する。
