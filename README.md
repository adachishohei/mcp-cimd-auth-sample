# Authenticated MCP Server

OAuth 2.1認証機能を持つリモートModel Context Protocol (MCP)サーバー

## 概要

本プロジェクトは、MCP仕様のClient ID Metadata Documents方式を使用した認証機能を実装するリモートMCPサーバーです。

### 主要コンポーネント

- **認可プロキシ**: API Gateway + Lambdaで実装され、OAuth 2.1認可フローを管理
- **Amazon Cognito**: ユーザー認証とトークン発行
- **MCPサーバー**: トークン検証とMCPツールの提供

## クイックスタート

初めての方は、[Getting Startedガイド](docs/GETTING_STARTED.md)を参照してください。

```bash
# 1. 依存関係のインストール
npm install

# 2. ビルド
npm run build

# 3. デプロイ
npm run deploy

# 4. テストユーザーの作成
./scripts/create-test-user.sh <USER_POOL_ID> test@example.com TestPassword123!

# 5. 動作確認
curl https://<MCP_SERVER_URL>/.well-known/oauth-protected-resource
```

詳細な手順は[Getting Started](docs/GETTING_STARTED.md)を参照してください。

## プロジェクト構造

```
.
├── lib/                      # CDKインフラストラクチャコード
│   ├── cdk-app.ts           # CDKアプリケーションエントリーポイント
│   └── authenticated-mcp-stack.ts  # メインスタック定義
├── src/                      # Lambda関数ソースコード
│   ├── auth-proxy/          # 認可プロキシ
│   │   ├── authorize.ts     # 認可エンドポイント
│   │   └── token.ts         # トークンエンドポイント
│   ├── mcp-server/          # MCPサーバー
│   │   ├── metadata.ts      # Protected Resource Metadata
│   │   └── mcp-handler.ts   # MCPプロトコルハンドラー
│   ├── types/               # 共有型定義
│   │   └── index.ts
│   └── utils/               # ユーティリティ
│       └── errors.ts
├── package.json
├── tsconfig.json
├── cdk.json
└── vitest.config.ts
```

## セットアップ

### 前提条件

- Node.js 18.x以上
- AWS CLI設定済み
- AWS CDK CLI (`npm install -g aws-cdk`)

### インストール

```bash
npm install
```

### ビルド

```bash
npm run build
```

### テスト

```bash
npm test
```

## デプロイ

### クイックスタート

```bash
# 依存関係のインストール、ビルド、デプロイを一括実行
make all

# または個別に実行
make install
make build
make deploy
```

### 初回デプロイ

```bash
# デプロイスクリプトを使用
./scripts/deploy.sh

# またはnpmスクリプトを使用
npm run deploy

# またはMakefileを使用
make deploy
```

デプロイ後、以下の情報が出力されます：

- `UserPoolId`: Cognito User Pool ID
- `UserPoolClientId`: Cognito User Pool Client ID
- `UserPoolDomain`: Cognito User Pool Domain
- `CognitoManagedUIUrl`: Cognito Managed UI URL
- `AuthProxyApiUrl`: 認可プロキシAPI URL
- `McpServerApiUrl`: MCPサーバーAPI URL
- `AuthorizeEndpoint`: 認可エンドポイント URL
- `TokenEndpoint`: トークンエンドポイント URL
- `ProtectedResourceMetadataEndpoint`: Protected Resource Metadata URL
- `McpEndpoint`: MCPプロトコルエンドポイント URL

### スタック出力の確認

```bash
# スクリプトを使用
./scripts/get-outputs.sh

# またはnpmスクリプトを使用
npm run outputs

# またはMakefileを使用
make outputs
```

### スタックの更新

```bash
# 更新スクリプトを使用（変更の確認プロンプト付き）
./scripts/update.sh

# またはMakefileを使用
make update
```

### スタックの削除

```bash
# 削除スクリプトを使用
./scripts/destroy.sh

# またはMakefileを使用
make destroy
```

### テストユーザーの作成

デプロイ後、テストユーザーを作成する必要があります。

#### 方法1: スクリプトを使用

```bash
./scripts/create-test-user.sh <USER_POOL_ID> <EMAIL> <PASSWORD>

# 例:
./scripts/create-test-user.sh us-east-1_XXXXXXXXX test@example.com TestPassword123!

# またはMakefileを使用
make create-user USER_POOL_ID=us-east-1_XXXXXXXXX EMAIL=test@example.com PASSWORD=TestPassword123!
```

#### 方法2: AWS CLIを直接使用

```bash
# ユーザーを作成
aws cognito-idp admin-create-user \
    --user-pool-id <USER_POOL_ID> \
    --username <EMAIL> \
    --user-attributes Name=email,Value=<EMAIL> Name=email_verified,Value=true \
    --message-action SUPPRESS

# パスワードを設定
aws cognito-idp admin-set-user-password \
    --user-pool-id <USER_POOL_ID> \
    --username <EMAIL> \
    --password <PASSWORD> \
    --permanent
```

#### 方法3: AWS Consoleを使用

1. AWS Console → Cognito → User Pools
2. 作成されたUser Poolを選択
3. "Users" タブ → "Create user"
4. メールアドレスとパスワードを入力
5. "Mark email address as verified" をチェック
6. "Create user"

### Cognito設定の確認

```bash
# スクリプトを使用
./scripts/verify-cognito-setup.sh <USER_POOL_ID>

# またはMakefileを使用
make verify-cognito USER_POOL_ID=us-east-1_XXXXXXXXX
```

デプロイされたCognito User Poolは以下の設定を持ちます：

- **認証方式**: Email/Username + Password
- **OAuth 2.1フロー**: Authorization Code Grant (PKCE必須)
- **スコープ**: 
  - `openid`
  - `email`
  - `profile`
  - `mcp-server/tools` (カスタムスコープ)
- **コールバックURL**: 
  - `http://localhost:3000/callback`
  - `https://localhost:3000/callback`
- **Managed UI**: 有効

## 開発

### ディレクトリ構造

- `lib/`: AWS CDKインフラストラクチャ定義
- `src/auth-proxy/`: OAuth 2.1認可プロキシのLambda関数
- `src/mcp-server/`: MCPサーバーのLambda関数
- `src/types/`: 共有型定義
- `src/utils/`: 共有ユーティリティ関数

### テスト戦略

- ユニットテスト: Vitestを使用
- プロパティベーステスト: 正確性プロパティの検証
- 統合テスト: エンドツーエンドフローの検証

## CI/CD

このプロジェクトには、GitHub Actionsを使用したCI/CDパイプラインが含まれています。

### ワークフロー

- **Test Workflow** (`.github/workflows/test.yml`): プルリクエストとmainブランチへのプッシュでテストを実行
- **Deploy Workflow** (`.github/workflows/deploy.yml`): mainブランチへのプッシュで自動デプロイを実行

### セットアップ

1. GitHubリポジトリの Settings > Secrets and variables > Actions で以下を設定：
   - `AWS_ROLE_ARN`: デプロイに使用するIAMロールのARN
   - `AWS_REGION`: デプロイ先のAWSリージョン

2. AWS IAMでOIDCプロバイダーとロールを設定（詳細は `docs/DEPLOYMENT.md` を参照）

詳細なデプロイ手順については、[デプロイメントガイド](docs/DEPLOYMENT.md)を参照してください。

## 利用可能なコマンド

### npm scripts

```bash
npm run build        # TypeScriptをビルド
npm run test         # テストを実行
npm run deploy       # CDKスタックをデプロイ
npm run synth        # CDKスタックをシンセサイズ
npm run diff         # スタックの変更を表示
npm run destroy      # スタックを削除
npm run bootstrap    # CDKブートストラップを実行
npm run deploy:ci    # CI用デプロイ（承認なし）
npm run outputs      # スタック出力を表示
```

### Make commands

```bash
make help            # 利用可能なコマンドを表示
make install         # 依存関係をインストール
make build           # TypeScriptをビルド
make test            # テストを実行
make deploy          # スタックをデプロイ
make update          # スタックを更新
make destroy         # スタックを削除
make outputs         # スタック出力を表示
make create-user     # テストユーザーを作成
make verify-cognito  # Cognito設定を確認
make all             # すべて実行
```

## 使用例

### 完全な認証フロー

以下は、MCPクライアントがMCPサーバーに接続する完全な認証フローの例です。

#### 1. Client ID Metadata Documentの準備

MCPクライアントは、HTTPS URLでClient ID Metadata Documentをホストする必要があります：

```json
{
  "client_id": "https://example.com/client.json",
  "client_name": "My MCP Client",
  "redirect_uris": [
    "http://localhost:3000/callback"
  ],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

#### 2. PKCEパラメータの生成

```javascript
// code_verifierの生成（ランダムな文字列）
const codeVerifier = generateRandomString(128);

// code_challengeの生成（SHA256ハッシュ、base64url エンコード）
const codeChallenge = base64url(sha256(codeVerifier));
```

#### 3. 認可リクエスト

ユーザーを認可エンドポイントにリダイレクト：

```bash
# 環境変数を設定（デプロイ後の出力から取得）
export AUTH_PROXY_URL="https://xxx.execute-api.us-east-1.amazonaws.com/prod"
export MCP_SERVER_URL="https://yyy.execute-api.us-east-1.amazonaws.com/prod"

# ブラウザで開く
open "${AUTH_PROXY_URL}/authorize?response_type=code&client_id=https://example.com/client.json&redirect_uri=http://localhost:3000/callback&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&state=xyz123&scope=mcp:tools&resource=${MCP_SERVER_URL}"
```

#### 4. ユーザー認証

Cognito Managed UIでユーザーがログインします。

#### 5. 認可コードの取得

認証成功後、クライアントのredirect_uriにリダイレクトされます：

```
http://localhost:3000/callback?code=AUTH_CODE&state=xyz123
```

#### 6. トークン交換

認可コードをアクセストークンに交換：

```bash
curl -X POST "${AUTH_PROXY_URL}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=${AUTH_CODE}" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=https://example.com/client.json" \
  -d "code_verifier=${CODE_VERIFIER}"
```

レスポンス：

```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJjdH..."
}
```

#### 7. MCPサーバーへのアクセス

取得したアクセストークンを使用してMCPサーバーにアクセス：

```bash
# Protected Resource Metadataの取得
curl "${MCP_SERVER_URL}/.well-known/oauth-protected-resource"

# ツールリストの取得
curl -X POST "${MCP_SERVER_URL}/mcp" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'

# ツールの実行（echoツール）
curl -X POST "${MCP_SERVER_URL}/mcp" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Hello, MCP!"
      }
    },
    "id": 2
  }'
```

### 簡易テストスクリプト

完全なフローをテストするための簡易スクリプト例：

```bash
#!/bin/bash

# 環境変数の設定
export AUTH_PROXY_URL="https://xxx.execute-api.us-east-1.amazonaws.com/prod"
export MCP_SERVER_URL="https://yyy.execute-api.us-east-1.amazonaws.com/prod"

# 1. Protected Resource Metadataの確認
echo "=== Protected Resource Metadata ==="
curl -s "${MCP_SERVER_URL}/.well-known/oauth-protected-resource" | jq .

# 2. 認証なしでアクセス（401エラーを期待）
echo -e "\n=== Unauthenticated Request (should return 401) ==="
curl -s -w "\nHTTP Status: %{http_code}\n" "${MCP_SERVER_URL}/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# 3. 認可フローの開始（ブラウザで開く）
echo -e "\n=== Starting Authorization Flow ==="
echo "Opening browser for authentication..."
# PKCEパラメータは事前に生成しておく
open "${AUTH_PROXY_URL}/authorize?response_type=code&client_id=https://example.com/client.json&redirect_uri=http://localhost:3000/callback&code_challenge=YOUR_CODE_CHALLENGE&code_challenge_method=S256&state=xyz123&scope=mcp:tools&resource=${MCP_SERVER_URL}"

echo "After authentication, exchange the code for a token using:"
echo "curl -X POST \"${AUTH_PROXY_URL}/token\" \\"
echo "  -H \"Content-Type: application/x-www-form-urlencoded\" \\"
echo "  -d \"grant_type=authorization_code\" \\"
echo "  -d \"code=YOUR_AUTH_CODE\" \\"
echo "  -d \"redirect_uri=http://localhost:3000/callback\" \\"
echo "  -d \"client_id=https://example.com/client.json\" \\"
echo "  -d \"code_verifier=YOUR_CODE_VERIFIER\""
```

## 環境変数

### 必須環境変数

デプロイ後、Lambda関数は以下の環境変数を使用します（CDKが自動的に設定）：

#### 認可プロキシ（/authorize, /token）

- `SESSION_TABLE_NAME`: DynamoDBテーブル名（PKCEセッションデータ用）
- `COGNITO_DOMAIN`: Cognito User Poolドメインプレフィックス
- `COGNITO_CLIENT_ID`: Cognito User Pool Client ID
- `COGNITO_REGION`: Cognitoのリージョン

#### MCPサーバー（/mcp, /.well-known/oauth-protected-resource）

- `MCP_SERVER_URI`: MCPサーバーのベースURI
- `AUTH_PROXY_URI`: 認可プロキシのベースURI
- `COGNITO_USER_POOL_ID`: Cognito User Pool ID
- `COGNITO_REGION`: Cognitoのリージョン
- `SUPPORTED_SCOPES`: サポートするOAuthスコープ（カンマ区切り）

### 環境変数の確認

デプロイ後、環境変数は自動的に設定されますが、確認したい場合：

```bash
# Lambda関数の環境変数を確認
aws lambda get-function-configuration \
  --function-name AuthenticatedMcpStack-AuthorizeFunction-XXXXX \
  --query 'Environment.Variables'
```

詳細は [環境設定ドキュメント](docs/ENVIRONMENT_SETUP.md) を参照してください。

## トラブルシューティング

### よくある問題

#### 1. デプロイエラー: "CDK bootstrap required"

```bash
# CDKブートストラップを実行
cdk bootstrap aws://ACCOUNT_ID/REGION
```

#### 2. 認可エラー: "client_id mismatch"

Client ID Metadata Document内の`client_id`フィールドが、リクエストのclient_id URLと完全に一致していることを確認してください。

#### 3. トークンエラー: "invalid_grant"

PKCE検証が失敗しています。`code_verifier`が正しく、認可リクエストで使用した`code_challenge`と対応していることを確認してください。

#### 4. 401エラー: "Token is invalid or expired"

アクセストークンが期限切れまたは無効です。トークンエンドポイントから新しいトークンを取得してください。

### ログの確認

```bash
# Lambda関数のログを確認
aws logs tail /aws/lambda/AuthenticatedMcpStack-AuthorizeFunction-XXXXX --follow

# 特定の時間範囲のログ
aws logs filter-log-events \
  --log-group-name /aws/lambda/AuthenticatedMcpStack-McpHandlerFunction-XXXXX \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

### DynamoDBセッションの確認

```bash
# セッションテーブルの内容を確認
aws dynamodb scan --table-name mcp-auth-sessions

# 特定のセッションを削除
aws dynamodb delete-item \
  --table-name mcp-auth-sessions \
  --key '{"sessionId": {"S": "SESSION_ID"}}'
```

詳細なトラブルシューティングは [クイックリファレンス](docs/QUICK_REFERENCE.md) を参照してください。

## ドキュメント

### はじめに

- **[Getting Started](docs/GETTING_STARTED.md)** - 初めての方向けセットアップガイド

### 主要ドキュメント

- **[使用ガイド](docs/USAGE_GUIDE.md)** - MCPクライアント実装の完全ガイド
- [デプロイメントガイド](docs/DEPLOYMENT.md) - 詳細なデプロイ手順とCI/CD設定
- [クイックリファレンス](docs/QUICK_REFERENCE.md) - よく使うコマンドとタスク
- [認可フロー例](docs/AUTHORIZATION_FLOW_EXAMPLE.md) - 完全な認可フローの詳細

### 設定ドキュメント

- [環境設定](docs/ENVIRONMENT_SETUP.md) - 環境変数の詳細説明
- [設定](docs/CONFIGURATION.md) - システム設定オプション
- [Cognito設定](docs/COGNITO_SETUP.md) - Cognito User Poolの設定詳細

### APIドキュメント

- **[APIリファレンス](docs/API_REFERENCE.md)** - 全エンドポイントの完全なAPI仕様
- [認可エンドポイント](docs/AUTHORIZE_ENDPOINT.md) - /authorizeエンドポイントの仕様
- [トークンエンドポイント](docs/TOKEN_ENDPOINT.md) - /tokenエンドポイントの仕様

### インフラストラクチャ

- [インフラストラクチャ](docs/INFRASTRUCTURE.md) - AWS CDKスタックの詳細

## セキュリティ考慮事項

### OAuth 2.1のベストプラクティス

1. **PKCE必須**: すべての認可コードフローでPKCEを使用
2. **HTTPS必須**: Client ID Metadata DocumentsはHTTPS経由で提供
3. **redirect_uri検証**: 厳密なredirect_uri検証により認可コード傍受を防止
4. **セッションTTL**: セッションは10分で期限切れ
5. **JWT検証**: すべてのアクセストークンはCognitoのJWKSで検証

### AWS セキュリティ

1. **IAM最小権限**: Lambda関数は必要最小限の権限のみ
2. **VPC分離**: 必要に応じてLambda関数をVPC内に配置可能
3. **暗号化**: DynamoDBテーブルは保存時に暗号化
4. **CloudWatch Logs**: すべてのリクエストをログに記録

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## ライセンス

MIT
