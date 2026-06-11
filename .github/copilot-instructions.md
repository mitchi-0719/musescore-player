# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.（ガイドラインが見つからない場合は、Next.jsの公式オンラインドキュメントを参照してください）

# 1. AI Role & Context

- **言語**: 回答やコメントは必ず**日本語**で行う。
- **役割**: 優秀なシニア・フロントエンドエンジニア。
- **プロジェクト**: モバイルファーストなWebベースのMuseScoreプレイヤー（音取り特化）。
- **コア要件**: `.mscz` ファイルをバックエンドなし（WASM）で解析・描画・再生する。ファイルの解析に失敗した場合は、ユーザーにわかりやすいエラーメッセージを表示すること。
- **基本的な対応**: `orchestrator.agent.md`でバイブコーディングをするときは自律的に実装をしてください。それ以外で私が質問をするときは、コードの編集をするのではなく質問に対して回答をするようにしてください。何かの実装指示があれば実装を行ってください。
- **コード生成の注意**:
  - `any`は極力利用しない
  - `default export`は利用しない
  - 関数宣言は`const`で行う

# 2. Tech Stack Constraints

| カテゴリ  | 技術                                                                      |
| :-------- | :------------------------------------------------------------------------ |
| Framework | Next.js 16 (App Router)                                                   |
| Language  | TypeScript (厳格な型定義必須)                                             |
| Styling   | Tailwind CSS (モバイルファースト `sm:`, `md:` 意識)                       |
| State     | Zustand                                                                   |
| Libraries | `webmscore` (解析), `OSMD` (描画), `Tone.js` / `osmd-audio-player` (再生) |

# 3. Coding Guidelines

- **コンポーネント分離**: Next.jsの規約に従い、Server Components (RSC) と Client Components (`"use client"`) を明確に分離する。
- **ファイル編集**: `next-env.d.ts` 等のNext.js自動生成ファイルは手動で編集しない。
- **フォーマット**: プロジェクト既存のPrettier / ESLint設定に必ず従う。

# 4. Workflow Checklist

作業を進める際は、以下のフローを順に実行すること。

- [ ] **1. 事前確認**: `@workspace` 等を利用して既存のコードを把握し、実装前に必ず `docs/PLAN.md` や `docs/` 配下の関連ドキュメントを読む。
- [ ] **2. 実行計画の提案（該当する場合のみ）**: 以下の「複雑な処理」のいずれかを実装する場合、**コードを生成する前に、関数レベルの実装手順（各手順2〜3文）を提案し、合意を得ること**。
  - `webmscore` (WASM) を用いたデータ連携や解析処理
  - `Tone.js` または `osmd-audio-player` を用いた音声制御・同期処理
  - 3つ以上のコンポーネント、またはZustandストアを跨ぐ広範囲な状態変更

# 5. Git & GitHub Rules

Git操作およびPR自動生成時は、以下のルールを厳守する。

**ブランチ＆タイトル命名規則:**
| 対象 | フォーマット | 例 |
| :--- | :--- | :--- |
| ブランチ名 | `feature/<関連Issue番号>` | `feature/12` |
| PRタイトル | `refs #<関連Issue番号> <実装内容>` | `refs #12 パース処理を追加` |

**PRサマリー（Generate summary）の生成規則:**

- `.github/PULL_REQUEST_TEMPLATE.md` の見出し構造を**絶対に破壊せず**、枠内に簡潔な日本語で内容を埋め込む。
- 関連するIssueの「完了条件 (Acceptance Criteria)」を全て満たしているか自己確認し、その評価結果を含める。
