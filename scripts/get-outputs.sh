#!/bin/bash

# スタック出力取得スクリプト
# このスクリプトは、デプロイされたスタックの出力値を取得します

set -e

STACK_NAME="AuthenticatedMcpStack"

echo "=========================================="
echo "スタック出力値"
echo "=========================================="
echo ""

# スタックの存在確認
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME &> /dev/null; then
    echo "エラー: スタック '$STACK_NAME' が見つかりません。"
    echo "まずデプロイを実行してください: ./scripts/deploy.sh"
    exit 1
fi

# 出力値を取得
outputs=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs' \
    --output json)

# 整形して表示
echo "$outputs" | jq -r '.[] | "\(.OutputKey): \(.OutputValue)"'

echo ""
echo "=========================================="
echo ""
echo "環境変数として設定する場合:"
echo ""
echo "export USER_POOL_ID=\$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==\`UserPoolId\`].OutputValue' --output text)"
echo "export USER_POOL_CLIENT_ID=\$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==\`UserPoolClientId\`].OutputValue' --output text)"
echo "export AUTH_PROXY_URL=\$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==\`AuthProxyApiUrl\`].OutputValue' --output text)"
echo "export MCP_SERVER_URL=\$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==\`McpServerApiUrl\`].OutputValue' --output text)"
echo ""
