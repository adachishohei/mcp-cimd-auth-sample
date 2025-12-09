# Getting Started

このガイドでは、認証付きMCPサーバーを初めて使用する方向けに、セットアップから最初のMCPツール呼び出しまでの手順を説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [ステップ1: プロジェクトのセットアップ](#ステップ1-プロジェクトのセットアップ)
4. [ステップ2: AWSへのデプロイ](#ステップ2-awsへのデプロイ)
5. [ステップ3: テストユーザーの作成](#ステップ3-テストユーザーの作成)
6. [ステップ4: 動作確認](#ステップ4-動作確認)
7. [次のステップ](#次のステップ)

## 概要

このプロジェクトは、OAuth 2.1認証を使用したリモートMCPサーバーです。以下のコンポーネントで構成されています：

- **認可プロキシ**: OAuth 2.1認可フローを管理
- **Amazon Cognito**: ユーザー認証とトークン発行
- **MCPサーバー**: 認証されたクライアントにツールを提供

## 前提条件

### 必須

- **Node.js**: バージョン18.x以上
- **AWS CLI**: 設定済み（`aws configure`実行済み）
- **AWS CDK CLI**: インストール済み（`npm install -g aws-cdk`）
- **AWSアカウント**: デプロイ権限を持つアカウント

### 推奨

- **jq**: JSON処理用（オプション）
- **curl**: APIテスト用

### AWS権限

以下のAWSサービスへのアクセス権限が必要です：

- Amazon Cognito
- API Gateway
- AWS Lambda
- Amazon DynamoDB
- AWS CloudFormation
- IAM（ロール作成用）

## ステップ1: プロジェクトのセットアップ

### 1.1 リポジトリのクローン

```bash
git clone <repository-url>
cd authenticated-mcp-server
```

### 1.2 依存関係のインストール

```bash
npm install
```

### 1.3 プロジェクトのビルド

```bash
npm run build
```

### 1.4 テストの実行（オプション）

```bash
npm test
```

すべてのテストが通ることを確認してください。

## ステップ2: AWSへのデプロイ

### 2.1 AWS認証情報の確認

```bash
# 現在のAWSアカウントを確認
aws sts get-caller-identity
```

出力例：
```json
{
    "UserId": "xxxxxxxxx",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### 2.2 CDKブートストラップ（初回のみ）

AWSアカウントでCDKを初めて使用する場合、ブートストラップが必要です：

```bash
cdk bootstrap aws://ACCOUNT_ID/REGION
```

例：
```bash
cdk bootstrap aws://123456789012/us-east-1
```

### 2.3 デプロイの実行

```bash
# 方法1: デプロイスクリプトを使用（推奨）
./scripts/deploy.sh

# 方法2: Makefileを使用
make deploy

# 方法3: npmスクリプトを使用
npm run deploy
```

デプロイには5〜10分かかります。

### 2.4 デプロイ出力の確認

デプロイが完了すると、以下のような出力が表示されます：

```
Outputs:
AuthenticatedMcpStack.UserPoolId = us-east-1_XXXXXXXXX
AuthenticatedMcpStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
AuthenticatedMcpStack.UserPoolDomain = mcp-auth-123456789012
AuthenticatedMcpStack.CognitoManagedUIUrl = https://mcp-auth-123456789012.auth.us-east-1.amazoncognito.com
AuthenticatedMcpStack.AuthProxyApiUrl = https://xxx.execute-api.us-east-1.amazonaws.com/prod
AuthenticatedMcpStack.McpServerApiUrl = https://yyy.execute-api.us-east-1.amazonaws.com/prod
AuthenticatedMcpStack.AuthorizeEndpoint = https://xxx.execute-api.us-east-1.amazonaws.com/prod/authorize
AuthenticatedMcpStack.TokenEndpoint = https://xxx.execute-api.us-east-1.amazonaws.com/prod/token
AuthenticatedMcpStack.ProtectedResourceMetadataEndpoint = https://yyy.execute-api.us-east-1.amazonaws.com/prod/.well-known/oauth-protected-resource
AuthenticatedMcpStack.McpEndpoint = https://yyy.execute-api.us-east-1.amazonaws.com/prod/mcp
```

これらの値をメモしてください。後で使用します。

### 2.5 環境変数の設定

```bash
# デプロイ出力から取得した値を設定
export USER_POOL_ID="us-east-1_XXXXXXXXX"
export USER_POOL_CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"
export AUTH_PROXY_URL="https://xxx.execute-api.us-east-1.amazonaws.com/prod"
export MCP_SERVER_URL="https://yyy.execute-api.us-east-1.amazonaws.com/prod"
```

または、後で簡単に取得できるようにスクリプトを使用：

```bash
./scripts/get-outputs.sh
```

## ステップ3: テストユーザーの作成

### 3.1 スクリプトを使用した作成

```bash
./scripts/create-test-user.sh $USER_POOL_ID test@example.com TestPassword123!
```

成功すると以下のメッセージが表示されます：
```
User created successfully
Password set successfully
User test@example.com is ready to use
```

### 3.2 AWS Consoleでの確認（オプション）

1. AWS Console → Cognito → User Pools
2. 作成されたUser Poolを選択
3. "Users" タブで作成したユーザーを確認

### 3.3 Cognito設定の確認

```bash
./scripts/verify-cognito-setup.sh $USER_POOL_ID
```

以下の情報が表示されます：
- User Pool設定
- OAuth設定
- ドメイン設定
- ユーザー一覧

## ステップ4: 動作確認

### 4.1 Protected Resource Metadataの取得

```bash
curl -s "${MCP_SERVER_URL}/.well-known/oauth-protected-resource" | jq .
```

期待される出力：
```json
{
  "resource": "https://yyy.execute-api.us-east-1.amazonaws.com/prod",
  "authorization_servers": [
    "https://xxx.execute-api.us-east-1.amazonaws.com/prod"
  ],
  "scopes_supported": [
    "mcp:tools"
  ]
}
```

### 4.2 未認証リクエストのテスト

```bash
curl -i "${MCP_SERVER_URL}/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

期待される出力（401エラー）：
```
HTTP/2 401
www-authenticate: Bearer realm="/.well-known/oauth-protected-resource"
...
```

これは正常な動作です。認証が必要なことを示しています。

### 4.3 認証フローのテスト

#### 4.3.1 PKCEパラメータの生成

```bash
# code_verifierの生成
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')

# code_challengeの生成
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | base64 | tr -d '=' | tr '+/' '-_')

echo "Code Verifier: $CODE_VERIFIER"
echo "Code Challenge: $CODE_CHALLENGE"
```

#### 4.3.2 認可URLの生成

```bash
# Client ID Metadata Document URL（テスト用）
CLIENT_ID="https://example.com/client.json"
REDIRECT_URI="http://localhost:3000/callback"

# 認可URLを構築
AUTH_URL="${AUTH_PROXY_URL}/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&state=xyz123&scope=mcp:tools&resource=${MCP_SERVER_URL}"

echo "Authorization URL:"
echo "$AUTH_URL"
```

**注意**: この時点では、`https://example.com/client.json`が実際に存在しないため、エラーになります。実際のテストには、Client ID Metadata Documentをホストする必要があります（[使用ガイド](USAGE_GUIDE.md)を参照）。

#### 4.3.3 簡易テスト用のClient ID Metadata Document

テスト用に、以下のようなJSONファイルを作成し、GitHub PagesやNetlifyなどでホストしてください：

```json
{
  "client_id": "https://yourusername.github.io/your-repo/client.json",
  "client_name": "Test MCP Client",
  "redirect_uris": [
    "http://localhost:3000/callback"
  ],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

#### 4.3.4 ブラウザでの認証

1. 生成した認可URLをブラウザで開く
2. Cognito Managed UIでログイン（作成したテストユーザーを使用）
3. リダイレクトURLに認可コードが含まれる：
   ```
   http://localhost:3000/callback?code=AUTH_CODE&state=xyz123
   ```

#### 4.3.5 トークンの取得

```bash
# 認可コードを環境変数に設定
AUTH_CODE="<ブラウザから取得した認可コード>"

# トークンリクエスト
curl -X POST "${AUTH_PROXY_URL}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=${AUTH_CODE}" \
  -d "redirect_uri=${REDIRECT_URI}" \
  -d "client_id=${CLIENT_ID}" \
  -d "code_verifier=${CODE_VERIFIER}" | jq .
```

期待される出力：
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJjdH..."
}
```

#### 4.3.6 MCPツールへのアクセス

```bash
# アクセストークンを環境変数に設定
ACCESS_TOKEN="<取得したアクセストークン>"

# ツールリストの取得
curl -X POST "${MCP_SERVER_URL}/mcp" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}' | jq .
```

期待される出力：
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "echo",
        "description": "Echo back the input message",
        "inputSchema": {
          "type": "object",
          "properties": {
            "message": {
              "type": "string",
              "description": "The message to echo back"
            }
          },
          "required": ["message"]
        }
      }
    ]
  },
  "id": 1
}
```

#### 4.3.7 ツールの実行

```bash
# echoツールの実行
curl -X POST "${MCP_SERVER_URL}/mcp" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Hello, MCP Server!"
      }
    },
    "id": 2
  }' | jq .
```

期待される出力：
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Echo: Hello, MCP Server!"
      }
    ]
  },
  "id": 2
}
```

## 次のステップ

おめでとうございます！認証付きMCPサーバーのセットアップと動作確認が完了しました。

### さらに学ぶ

1. **MCPクライアントの実装**
   - [使用ガイド](USAGE_GUIDE.md)で完全なクライアント実装例を確認
   - JavaScriptやPythonでのクライアント実装

2. **カスタムツールの追加**
   - `src/mcp-server/mcp-handler.ts`を編集して新しいツールを追加
   - ツールの入力スキーマと実装を定義

3. **本番環境へのデプロイ**
   - [デプロイメントガイド](DEPLOYMENT.md)でCI/CD設定を確認
   - GitHub Actionsを使用した自動デプロイ

4. **セキュリティの強化**
   - カスタムドメインの設定
   - WAFの追加
   - CloudWatch Logsの監視設定

### トラブルシューティング

問題が発生した場合：

1. **ログの確認**
   ```bash
   # Lambda関数のログを確認
   aws logs tail /aws/lambda/AuthenticatedMcpStack-AuthorizeFunction-XXXXX --follow
   ```

2. **スタックの状態確認**
   ```bash
   aws cloudformation describe-stacks --stack-name AuthenticatedMcpStack
   ```

3. **リソースの確認**
   ```bash
   aws cloudformation list-stack-resources --stack-name AuthenticatedMcpStack
   ```

詳細は[クイックリファレンス](QUICK_REFERENCE.md)を参照してください。

### サポート

- **ドキュメント**: [docs/](.)ディレクトリ内のドキュメントを参照
- **Issues**: GitHubのIssuesで質問や問題を報告
- **MCP仕様**: [mcp-spec.html](../mcp-spec.html)でMCPプロトコルの詳細を確認

## まとめ

このガイドでは以下を実施しました：

1. ✅ プロジェクトのセットアップとビルド
2. ✅ AWSへのデプロイ
3. ✅ テストユーザーの作成
4. ✅ 認証フローの動作確認
5. ✅ MCPツールへのアクセス

これで、認証付きMCPサーバーを使用する準備が整いました！
