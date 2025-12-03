#!/bin/bash

# ローカルテストスクリプト
# このスクリプトは、デプロイ前にローカルでテストを実行します

set -e

echo "=========================================="
echo "ローカルテスト実行"
echo "=========================================="
echo ""

# TypeScriptのビルド
echo "1. TypeScriptをビルド中..."
npm run build

# テストの実行
echo ""
echo "2. テストを実行中..."
npm test

# CDKシンセサイズ（検証）
echo ""
echo "3. CDKスタックを検証中..."
npm run synth > /dev/null

echo ""
echo "=========================================="
echo "すべてのテストが成功しました！"
echo "=========================================="
echo ""
echo "デプロイの準備ができました。"
echo "デプロイするには: ./scripts/deploy.sh"
echo ""
