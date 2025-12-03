#!/bin/bash

# スタック削除スクリプト
# このスクリプトは、デプロイされたAuthenticated MCP Serverスタックを削除します

set -e

echo "=========================================="
echo "Authenticated MCP Server スタック削除"
echo "=========================================="
echo ""

# 確認プロンプト
read -p "本当にスタックを削除しますか？ (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "削除をキャンセルしました。"
    exit 0
fi

echo ""
echo "スタックを削除中..."
cdk destroy --force

echo ""
echo "=========================================="
echo "スタックの削除が完了しました！"
echo "=========================================="
echo ""
