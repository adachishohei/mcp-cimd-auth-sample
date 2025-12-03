# クイックリファレンス

よく使うコマンドとタスクのクイックリファレンスです。

## デプロイ関連

### 初回デプロイ

```bash
# 方法1: デプロイスクリプト
./scripts/deploy.sh

# 方法2: Make
make deploy

# 方法3: npm
npm run deploy
```

### スタック更新

```bash
# 変更を確認してからデプロイ
./scripts/update.sh

# または
make update
```

### スタック削除

```bash
./scripts/destroy.sh
# または
make destroy
```

### スタック出力の確認

```bash
./scripts/get-outputs.sh
# または
make outputs
# または
npm run outputs
```

## ビルドとテスト

### ビルド

```bash
npm run build
# または
make build
```

### テスト実行

```bash
npm test
# または
make test
```

### ローカルテスト（ビルド + テスト + 検証）

```bash
./scripts/local-test.sh
```

### CDK検証

```bash
npm run synth
# または
make synth
```

### 変更の確認

```bash
npm run diff
# または
make diff
```

## ユーザー管理

### テストユーザー作成

```bash
# スクリプト
./scripts/create-test-user.sh <USER_POOL_ID> <EMAIL> <PASSWORD>

# Make
make create-user USER_POOL_ID=us-east-1_XXX EMAIL=test@example.com PASSWORD=Test123!

# AWS CLI直接
aws cognito-idp admin-create-user \
    --user-pool-id <USER_POOL_ID> \
    --username <EMAIL> \
    --user-attributes Name=email,Value=<EMAIL> Name=email_verified,Value=true \
    --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
    --user-pool-id <USER_POOL_ID> \
    --username <EMAIL> \
    --password <PASSWORD> \
    --permanent
```

### Cognito設定確認

```bash
# スクリプト
./scripts/verify-cognito-setup.sh <USER_POOL_ID>

# Make
make verify-cognito USER_POOL_ID=us-east-1_XXX
```

### ユーザー一覧表示

```bash
aws cognito-idp list-users --user-pool-id <USER_POOL_ID>
```

### ユーザー削除

```bash
aws cognito-idp admin-delete-user \
    --user-pool-id <USER_POOL_ID> \
    --username <EMAIL>
```

## スタック情報取得

### User Pool ID取得

```bash
aws cloudformation describe-stacks \
    --stack-name AuthenticatedMcpStack \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text
```

### API Gateway URL取得

```bash
# 認可プロキシAPI
aws cloudformation describe-stacks \
    --stack-name AuthenticatedMcpStack \
    --query 'Stacks[0].Outputs[?OutputKey==`AuthProxyApiUrl`].OutputValue' \
    --output text

# MCPサーバーAPI
aws cloudformation describe-stacks \
    --stack-name AuthenticatedMcpStack \
    --query 'Stacks[0].Outputs[?OutputKey==`McpServerApiUrl`].OutputValue' \
    --output text
```

### すべての出力を環境変数として設定

```bash
export USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name AuthenticatedMcpStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
export USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name AuthenticatedMcpStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
export AUTH_PROXY_URL=$(aws cloudformation describe-stacks --stack-name AuthenticatedMcpStack --query 'Stacks[0].Outputs[?OutputKey==`AuthProxyApiUrl`].OutputValue' --output text)
export MCP_SERVER_URL=$(aws cloudformation describe-stacks --stack-name AuthenticatedMcpStack --query 'Stacks[0].Outputs[?OutputKey==`McpServerApiUrl`].OutputValue' --output text)
```

## ログ確認

### Lambda関数のログ

```bash
# 最新のログストリームを表示
aws logs tail /aws/lambda/AuthenticatedMcpStack-AuthorizeFunction-XXXXX --follow

# 特定の時間範囲のログ
aws logs filter-log-events \
    --log-group-name /aws/lambda/AuthenticatedMcpStack-AuthorizeFunction-XXXXX \
    --start-time $(date -u -d '1 hour ago' +%s)000
```

### すべてのLambda関数のログストリーム

```bash
# ログストリーム一覧
aws logs describe-log-streams \
    --log-group-name /aws/lambda/AuthenticatedMcpStack-AuthorizeFunction-XXXXX \
    --order-by LastEventTime \
    --descending \
    --max-items 5
```

## DynamoDB操作

### セッションテーブルのアイテム一覧

```bash
aws dynamodb scan --table-name mcp-auth-sessions
```

### 特定のセッション取得

```bash
aws dynamodb get-item \
    --table-name mcp-auth-sessions \
    --key '{"sessionId": {"S": "SESSION_ID"}}'
```

### セッション削除

```bash
aws dynamodb delete-item \
    --table-name mcp-auth-sessions \
    --key '{"sessionId": {"S": "SESSION_ID"}}'
```

### すべてのセッション削除

```bash
aws dynamodb scan --table-name mcp-auth-sessions --attributes-to-get sessionId --output json | \
jq -r '.Items[].sessionId.S' | \
while read sessionId; do
    aws dynamodb delete-item --table-name mcp-auth-sessions --key "{\"sessionId\": {\"S\": \"$sessionId\"}}"
done
```

## API テスト

### Protected Resource Metadata取得

```bash
curl https://YOUR_MCP_SERVER_URL/.well-known/oauth-protected-resource
```

### 認可リクエスト（ブラウザで開く）

```bash
open "https://YOUR_AUTH_PROXY_URL/authorize?response_type=code&client_id=https://example.com/client.json&redirect_uri=http://localhost:3000/callback&code_challenge=CHALLENGE&code_challenge_method=S256&resource=https://YOUR_MCP_SERVER_URL&scope=mcp:tools"
```

### トークンリクエスト

```bash
curl -X POST https://YOUR_AUTH_PROXY_URL/token \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code" \
    -d "code=AUTH_CODE" \
    -d "redirect_uri=http://localhost:3000/callback" \
    -d "client_id=https://example.com/client.json" \
    -d "code_verifier=VERIFIER"
```

### MCPリクエスト（認証付き）

```bash
curl -X POST https://YOUR_MCP_SERVER_URL/mcp \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "tools/list",
        "id": 1
    }'
```

## トラブルシューティング

### CDKブートストラップ

```bash
cdk bootstrap aws://ACCOUNT_ID/REGION
```

### Lambda関数の再デプロイ

```bash
# ビルドしてデプロイ
npm run build
cdk deploy --force
```

### スタックの状態確認

```bash
aws cloudformation describe-stacks --stack-name AuthenticatedMcpStack
```

### スタックイベント確認

```bash
aws cloudformation describe-stack-events \
    --stack-name AuthenticatedMcpStack \
    --max-items 20
```

### リソースの確認

```bash
aws cloudformation list-stack-resources --stack-name AuthenticatedMcpStack
```

## クリーンアップ

### ビルド成果物削除

```bash
make clean
# または
rm -rf dist/ cdk.out/ node_modules/
```

### 完全なクリーンアップと再インストール

```bash
make clean
make install
make build
```

## 環境変数

### 必要な環境変数

```bash
# AWS認証情報
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1

# CDK
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1
```

### 環境変数の確認

```bash
env | grep AWS
```

## よく使うAWS CLIコマンド

### 現在のAWSアカウント確認

```bash
aws sts get-caller-identity
```

### リージョン一覧

```bash
aws ec2 describe-regions --output table
```

### CloudFormationスタック一覧

```bash
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

## ヘルプ

### Makeコマンド一覧

```bash
make help
```

### CDKコマンドヘルプ

```bash
cdk --help
cdk deploy --help
```

### AWS CLIヘルプ

```bash
aws help
aws cognito-idp help
aws cloudformation help
```
