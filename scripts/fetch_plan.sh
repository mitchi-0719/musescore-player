#!/bin/bash

# エラーが発生したら即座にスクリプトを終了
set -e

ENV_FILE="./.env"

# 1. カレントディレクトリの .env ファイルの存在確認と読み込み
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo -e "[31mエラー: 実行ディレクトリに .env ファイルが見つかりません。($ENV_FILE)" >&2
    exit 1
fi

# 2. 必要な環境変数が取得できているかチェック
if [ -z "$NOTION_PROJECT_PAGE_ID" ]; then
    echo -e "[31mエラー: .env 内に NOTION_PROJECT_PAGE_ID が設定されていません。" >&2
    exit 1
fi

# 3. 保存先となる docs ディレクトリの作成
OUTPUT_DIR="./docs"
mkdir -p "$OUTPUT_DIR"

TARGET_FILE="$OUTPUT_DIR/PLAN.md"

# 4. 既存の PLAN.md があれば事前に削除
if [ -f "$TARGET_FILE" ]; then
    rm "$TARGET_FILE"
fi

# 5. CLIツールを実行して新しく保存（標準出力・標準エラー出力を両方キャッチ）
echo "最新のMarkdownを取得中..."

# 一時ファイルにCLIのすべての出力を保存
TMP_LOG=$(mktemp)
# ※ your_cli_tool の部分は実際のコマンドに書き換えてください
# 2>&1 でエラー出力も一緒に TMP_LOG に流し込みます
ntn pages get "$NOTION_PROJECT_PAGE_ID" > "$TARGET_FILE" 2> "$TMP_LOG" || true

# 6. ワーニングの検知とターミナルへの出力
# ファイルの中身、またはエラーログに "warning:" や "truncated" が含まれるかチェック
if grep -qi -E "warning:|truncated" "$TARGET_FILE" "$TMP_LOG"; then
    echo -e "\n================================================================"
    echo -e "【⚠️ 警告】Notionからのデータ取得が途中で切り捨てられました！"
    echo -e "ページサイズが大きすぎるため、すべてのブロックが取得できていません。"
    echo -e "================================================================\n"
else
    echo -e "\n完了: $TARGET_FILE を正常に更新しました。\n"
fi

# 一時ファイルの削除
rm -f "$TMP_LOG"