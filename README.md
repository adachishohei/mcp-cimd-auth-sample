# Authenticated MCP Server

OAuth 2.1認証機能を持つリモートModel Context Protocol (MCP)サーバー

## 目次

- [概要](#概要)
- [クイックスタート](#クイックスタート)
- [プロジェクト構造](#プロジェクト構造)
- [セットアップ](#セットアップ)
- [デプロイ](#デプロイ)
- [MCP Client設定例](#mcp-client設定例)
- [使用例](#使用例)
- [MCP Inspectorを使ったテスト](#mcp-inspectorを使ったテスト)
- [環境変数](#環境変数)
- [トラブルシューティング](#トラブルシューティング)
- [ドキュメント](#ドキュメント)
- [ライセンス](#ライセンス)

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
│   │   ├── token.ts         # トークンエンドポイント
│   │   ├── callback.ts      # Cognitoコールバック
│   │   ├── consent.ts       # 同意画面
│   │   ├── consent-action.ts # 同意アクション
│   │   └── auth-server-metadata.ts # Authorization Server Metadata
│   ├── mcp-server/          # MCPサーバー
│   │   ├── metadata.ts      # Protected Resource Metadata
│   │   ├── mcp-handler.ts   # MCPプロトコルハンドラー
│   │   └── jwt-middleware.ts # JWT検証ミドルウェア
│   ├── config/              # 設定管理
│   │   └── index.ts         # 集約設定
│   ├── types/               # 共有型定義
│   │   └── index.ts
│   ├── utils/               # ユーティリティ
│   │   ├── errors.ts        # エラークラス
│   │   ├── error-handler.ts # 共通エラーハンドリング
│   │   └── validation.ts    # OAuth2バリデーション
│   └── __tests__/           # テスト
│       └── helpers/         # テストヘルパー
│           ├── mocks.ts     # モックデータ
│           └── assertions.ts # アサーションヘルパー
├── docs/                     # ドキュメント
│   ├── getting-started/     # 入門ガイド
│   ├── configuration/       # 設定ドキュメント
│   ├── api/                 # APIリファレンス
│   ├── guides/              # 使用ガイド
│   └── architecture/        # アーキテクチャドキュメント
├── scripts/                  # デプロイ・管理スクリプト
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

```
Outputs:
AuthenticatedMcpStack.UserPoolId = us-east-1_XXXXXXXXX
AuthenticatedMcpStack.UserPoolClientId = 1234567890abcdefghijklmnop
AuthenticatedMcpStack.UserPoolDomain = mcp-auth-123456789012
AuthenticatedMcpStack.CognitoManagedUIUrl = https://mcp-auth-123456789012.auth.us-east-1.amazoncognito.com
AuthenticatedMcpStack.AuthProxyApiUrl = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/
AuthenticatedMcpStack.McpServerApiUrl = https://def456uvw.execute-api.us-east-1.amazonaws.com/prod/
AuthenticatedMcpStack.AuthorizeEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/authorize
AuthenticatedMcpStack.TokenEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/token
AuthenticatedMcpStack.AuthServerMetadataEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/.well-known/oauth-authorization-server
AuthenticatedMcpStack.CallbackEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/callback
AuthenticatedMcpStack.ConsentEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/consent
AuthenticatedMcpStack.ProtectedResourceMetadataEndpoint = https://def456uvw.execute-api.us-east-1.amazonaws.com/prod/.well-known/oauth-protected-resource
AuthenticatedMcpStack.McpEndpoint = https://def456uvw.execute-api.us-east-1.amazonaws.com/prod/mcp
```

**これらの値をMCP Client設定に使用してください。**

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
  - `openid` - 基本的なユーザー識別情報
  - `email` - ユーザーのメールアドレス
  - `profile` - ユーザープロファイル情報
- **コールバックURL**: 
  - `http://localhost:3000/callback`
  - `https://localhost:3000/callback`
- **Managed UI**: 有効

**注意**: 現在の実装では標準OAuthスコープのみを使用しています。カスタムスコープが必要な場合は、デプロイ後にCognitoコンソールから追加できます。

## 開発

### ディレクトリ構造

- `lib/`: AWS CDKインフラストラクチャ定義
- `src/auth-proxy/`: OAuth 2.1認可プロキシのLambda関数
- `src/mcp-server/`: MCPサーバーのLambda関数
- `src/config/`: 集約設定管理
- `src/types/`: 共有型定義
- `src/utils/`: 共有ユーティリティ関数
  - `errors.ts`: カスタムエラークラス
  - `error-handler.ts`: 共通エラーハンドリング
  - `validation.ts`: OAuth2パラメータバリデーション
- `src/__tests__/helpers/`: テストヘルパー
  - `mocks.ts`: 共通モックデータ
  - `assertions.ts`: テストアサーション

### テスト戦略

- ユニットテスト: Vitestを使用
- 共通テストヘルパー: モックデータとアサーション関数を提供
- プロパティベーステスト: 正確性プロパティの検証
- 統合テスト: エンドツーエンドフローの検証

### コード品質

- TypeScript厳格モード
- 共通エラーハンドリング: `withErrorHandling`ラッパー
- 統一されたバリデーション: OAuth2パラメータの検証
- テストカバレッジ: 主要機能の包括的なテスト

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

## MCP Client設定例

デプロイ後、MCP Clientに以下の情報を設定してください。

### 必要な情報の取得

デプロイ後、以下のコマンドでエンドポイント情報を取得できます：

```bash
./scripts/get-outputs.sh
# または
make outputs
```

### Claude Desktop設定例

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) または `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "authenticated-mcp": {
      "url": "https://YOUR_MCP_SERVER_ID.execute-api.us-east-1.amazonaws.com/prod/mcp",
      "transport": {
        "type": "http"
      },
      "auth": {
        "type": "oauth2",
        "authorizationUrl": "https://YOUR_AUTH_PROXY_ID.execute-api.us-east-1.amazonaws.com/prod/authorize",
        "tokenUrl": "https://YOUR_AUTH_PROXY_ID.execute-api.us-east-1.amazonaws.com/prod/token",
        "clientId": "https://your-domain.com/client-metadata.json",
        "scopes": ["openid", "email", "profile"],
        "pkce": true
      }
    }
  }
}
```

### 設定値の説明

| 項目 | 説明 | 取得方法 |
|------|------|----------|
| `url` | MCPサーバーエンドポイント | `McpEndpoint`の出力値 |
| `authorizationUrl` | 認可エンドポイント | `AuthorizeEndpoint`の出力値 |
| `tokenUrl` | トークンエンドポイント | `TokenEndpoint`の出力値 |
| `clientId` | Client ID Metadata DocumentのURL | 自身でホストする必要があります |
| `scopes` | 要求するスコープ | `["openid", "email", "profile"]` |
| `pkce` | PKCE使用フラグ | 常に`true` |

### Client ID Metadata Documentの準備

MCPクライアントは、HTTPS URLでClient ID Metadata Documentをホストする必要があります。

**例: `https://your-domain.com/client-metadata.json`**

```json
{
  "client_id": "https://your-domain.com/client-metadata.json",
  "client_name": "My MCP Client",
  "client_uri": "https://your-domain.com",
  "logo_uri": "https://your-domain.com/logo.png",
  "redirect_uris": [
    "http://localhost:3000/callback",
    "https://your-domain.com/callback"
  ],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "openid email profile"
}
```

**重要な注意事項:**
- `client_id`はこのドキュメント自身のURLと完全に一致する必要があります
- `redirect_uris`にはMCPクライアントのコールバックURLを含める必要があります
- HTTPSでホストする必要があります（開発時は`http://localhost`も可）

### 簡易テスト用設定

開発・テスト目的で、GitHub Gistを使用してClient ID Metadata Documentをホストできます：

1. GitHub Gistで新しいファイルを作成
2. 上記のJSONを貼り付け（`client_id`をGistのRaw URLに変更）
3. "Create public gist"をクリック
4. "Raw"ボタンをクリックしてURLを取得
5. そのURLを`clientId`として使用

**例:**
```
https://gist.githubusercontent.com/username/gist-id/raw/client-metadata.json
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
open "${AUTH_PROXY_URL}/authorize?response_type=code&client_id=https://example.com/client.json&redirect_uri=http://localhost:3000/callback&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&state=xyz123&scope=openid%20email%20profile&resource=${MCP_SERVER_URL}"
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

## MCP Inspectorを使ったテスト

[MCP Inspector](https://github.com/modelcontextprotocol/inspector)は、MCPサーバーの動作を視覚的にテストできる公式ツールです。

### インストール

```bash
npm install -g @modelcontextprotocol/inspector
```

### 基本的な使い方

#### 1. MCP Inspectorの起動

```bash
mcp-inspector
```

ブラウザで `http://localhost:5173` が開きます。

#### 2. サーバー接続設定

MCP Inspectorの設定画面で以下を入力：

**Server URL:**
```
https://YOUR_MCP_SERVER_ID.execute-api.us-east-1.amazonaws.com/prod/mcp
```

**Transport Type:**
- `HTTP` を選択

**Authentication:**
- Type: `OAuth 2.0`
- Authorization URL: `https://YOUR_AUTH_PROXY_ID.execute-api.us-east-1.amazonaws.com/prod/authorize`
- Token URL: `https://YOUR_AUTH_PROXY_ID.execute-api.us-east-1.amazonaws.com/prod/token`
- Client ID: `https://your-domain.com/client-metadata.json`
- Scopes: `openid email profile`
- PKCE: `Enabled`

#### 3. 認証フロー

1. "Connect" ボタンをクリック
2. 認証画面が開くので、Cognitoでログイン
3. 認証成功後、自動的にMCP Inspectorに戻ります

#### 4. ツールのテスト

接続後、以下の操作が可能です：

- **Tools タブ**: 利用可能なツールの一覧表示
- **Execute**: ツールの実行とレスポンスの確認
- **Resources タブ**: リソースの一覧（実装されている場合）
- **Prompts タブ**: プロンプトの一覧（実装されている場合）

### トラブルシューティング

#### CORS エラーが発生する場合

API GatewayのCORS設定を確認してください。現在の実装では`Cors.ALL_ORIGINS`を許可していますが、本番環境では特定のオリジンのみを許可することを推奨します。

#### 認証がループする場合

1. Client ID Metadata Documentが正しくホストされているか確認
2. `redirect_uris`にMCP Inspectorのコールバック URL（通常は`http://localhost:5173/callback`）が含まれているか確認
3. ブラウザのキャッシュとCookieをクリア

### Client ID Metadata Document（MCP Inspector用）

MCP Inspectorを使用する場合、以下のようなClient ID Metadata Documentを準備してください：

```json
{
  "client_id": "https://your-domain.com/mcp-inspector-client.json",
  "client_name": "MCP Inspector",
  "client_uri": "http://localhost:5173",
  "redirect_uris": [
    "http://localhost:5173/callback",
    "http://localhost:5173/oauth/callback"
  ],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "openid email profile"
}
```

### デモ動画

MCP Inspectorの使い方については、[公式ドキュメント](https://github.com/modelcontextprotocol/inspector)を参照してください。

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

## ドキュメント

詳細なドキュメントは`docs/`ディレクトリにあります：

### 入門ガイド
- [Getting Started](docs/GETTING_STARTED.md) - 初めての方向けのセットアップガイド
- [Quick Reference](docs/QUICK_REFERENCE.md) - よく使うコマンドのクイックリファレンス

### 設定・デプロイ
- [Environment Setup](docs/ENVIRONMENT_SETUP.md) - 環境変数の設定方法
- [Configuration](docs/CONFIGURATION.md) - 設定管理の詳細
- [Deployment](docs/DEPLOYMENT.md) - デプロイメント手順
- [Infrastructure](docs/INFRASTRUCTURE.md) - インフラストラクチャの詳細

### 認証・認可
- [Cognito Setup](docs/COGNITO_SETUP.md) - Cognito User Poolの設定
- [Authorization Flow](docs/AUTHORIZATION_FLOW_EXAMPLE.md) - 認可フローの例
- [Client Metadata Document](docs/CLIENT_METADATA_DOCUMENT.md) - Client ID Metadata Documentの仕様

### API リファレンス
- [API Reference](docs/API_REFERENCE.md) - 全エンドポイントのAPIリファレンス
- [Usage Guide](docs/USAGE_GUIDE.md) - 使用方法の詳細ガイド

### 実装詳細
- [Consent Flow](docs/CONSENT_FLOW_ANALYSIS.md) - 同意画面フローの分析
- [Token Endpoint](docs/TOKEN_ENDPOINT.md) - トークンエンドポイントの実装
- [Authorization Endpoint](docs/AUTHORIZE_ENDPOINT.md) - 認可エンドポイントの実装

## ライセンス

MIT
