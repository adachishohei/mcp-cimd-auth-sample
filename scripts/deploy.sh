#!/bin/bash

# デプロイスクリプト
# このスクリプトは、Authenticated MCP Serverをデプロイします

set -e

echo "=========================================="
echo "Authenticated MCP Server デプロイ"
echo "=========================================="
echo ""

# 環境変数のチェック
if [ -z "$AWS_REGION" ]; then
    echo "警告: AWS_REGION環境変数が設定されていません。デフォルトリージョンを使用します。"
fi

# 依存関係のインストール
echo "1. 依存関係をインストール中..."
npm install

# TypeScriptのビルド
echo ""
echo "2. TypeScriptをビルド中..."
npm run build

# CDKのブートストラップ（初回のみ必要）
echo ""
echo "3. CDKブートストラップを確認中..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
    echo "CDKToolkitスタックが見つかりません。ブートストラップを実行します..."
    cdk bootstrap
else
    echo "CDKToolkitスタックは既に存在します。"
fi

# CDKスタックのシンセサイズ
echo ""
echo "4. CDKスタックをシンセサイズ中..."
cdk synth

# デプロイ
echo ""
echo "5. CDKスタックをデプロイ中..."
cdk deploy --require-approval never

echo ""
echo "=========================================="
echo "デプロイが完了しました！"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. 出力された値を確認してください"
echo "2. テストユーザーを作成してください:"
echo "   ./scripts/create-test-user.sh <USER_POOL_ID> <EMAIL> <PASSWORD>"
echo "3. Cognito設定を確認してください:"
echo "   ./scripts/verify-cognito-setup.sh <USER_POOL_ID>"
echo ""
