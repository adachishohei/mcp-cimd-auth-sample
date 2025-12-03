#!/bin/bash

# 更新スクリプト
# このスクリプトは、既存のスタックを更新します

set -e

echo "=========================================="
echo "Authenticated MCP Server 更新"
echo "=========================================="
echo ""

# TypeScriptのビルド
echo "1. TypeScriptをビルド中..."
npm run build

# 変更の確認
echo ""
echo "2. 変更を確認中..."
cdk diff

# 更新の確認
echo ""
read -p "この変更でスタックを更新しますか？ (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "更新をキャンセルしました。"
    exit 0
fi

# デプロイ
echo ""
echo "3. スタックを更新中..."
cdk deploy --require-approval never

echo ""
echo "=========================================="
echo "更新が完了しました！"
echo "=========================================="
echo ""
