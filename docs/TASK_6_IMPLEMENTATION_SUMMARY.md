# Task 6 Implementation Summary: JWT検証ミドルウェア

## 実装概要

タスク6「MCPサーバー - JWT検証ミドルウェアの実装」を完了しました。このタスクでは、Amazon CognitoのJWKSを使用してJWTトークンを検証し、MCPサーバーへのアクセスを保護するミドルウェアを実装しました。

## 実装したコンポーネント

### 1. JWT検証ミドルウェア (`src/mcp-server/jwt-middleware.ts`)

以下の機能を実装しました：

#### a. `extractBearerToken()`
- **要件 5.1**: Authorizationヘッダーからベアラートークンを抽出
- 大文字・小文字両方の`Authorization`ヘッダーに対応
- 不正な形式のヘッダーを適切に処理

#### b. `createUnauthorizedResponse()`
- **要件 5.1, 5.2**: HTTP 401レスポンスとWWW-Authenticateヘッダーの生成
- `realm`パラメータでProtected Resource Metadata URLを指定
- `error`と`error_description`パラメータのサポート
- レスポンスボディにエラー詳細を含める

#### c. `verifyJWT()`
- **要件 5.3**: CognitoのJWKSを使用したJWT署名検証
- `jose`ライブラリを使用した安全な検証
- 以下のクレームを検証：
  - `issuer`: Cognito User PoolのIssuer URL
  - `audience`: Cognito Client ID
  - `expiration`: トークンの有効期限
- 詳細なエラーハンドリング：
  - 期限切れトークン
  - 無効な署名
  - クレーム検証失敗

#### d. `verifyJWTMiddleware()`
- **要件 5.1, 5.2, 5.3, 5.4, 5.5**: 統合されたJWT検証ミドルウェア
- トークン抽出から検証までの完全なフロー
- 環境変数からCognito設定を取得
- 適切なレスポンスを返却：
  - 認証成功: `{ authorized: true, payload: JWTPayload }`
  - 認証失敗: `{ authorized: false, response: APIGatewayProxyResult }`

### 2. MCPハンドラーの更新 (`src/mcp-server/mcp-handler.ts`)

- JWT検証ミドルウェアを統合
- **要件 5.1, 5.5**: 未認証または無効なトークンのリクエストを拒否
- **要件 5.4**: 有効なトークンのリクエストを処理（タスク7で完全実装予定）
- Protected Resource Metadata URLを環境変数から取得

### 3. CDKスタックの更新 (`lib/authenticated-mcp-stack.ts`)

- MCPハンドラーLambda関数を追加
- 必要な環境変数を設定：
  - `MCP_SERVER_URI`: MCPサーバーのURI
  - `COGNITO_USER_POOL_ID`: Cognito User Pool ID
  - `COGNITO_REGION`: AWSリージョン
  - `COGNITO_CLIENT_ID`: Cognito Client ID
- `/mcp`エンドポイントをAPI Gatewayに追加
- CloudFormation出力を追加

### 4. ユニットテスト

#### a. JWT Middleware Tests (`src/mcp-server/__tests__/jwt-middleware.test.ts`)

**extractBearerToken()のテスト:**
- ✅ 正しい形式のAuthorizationヘッダーからトークンを抽出
- ✅ 小文字の`authorization`ヘッダーに対応
- ✅ ヘッダーが欠落している場合にnullを返す
- ✅ Bearer以外の認証方式を拒否
- ✅ 不正な形式のヘッダーを拒否

**createUnauthorizedResponse()のテスト:**
- ✅ 401レスポンスとWWW-Authenticateヘッダーを生成
- ✅ realmパラメータを含める
- ✅ errorパラメータを含める（提供された場合）
- ✅ error_descriptionパラメータを含める（提供された場合）
- ✅ レスポンスボディにエラー詳細を含める

**verifyJWTMiddleware()のテスト:**
- ✅ Authorizationヘッダーが欠落している場合に401を返す
- ✅ 環境変数が欠落している場合に500を返す

#### b. MCP Handler Tests (`src/mcp-server/__tests__/mcp-handler.test.ts`)

- ✅ JWT検証が失敗した場合に401を返す
- ✅ JWT検証が成功した場合にリクエストを処理
- ✅ 正しいProtected Resource Metadata URLを使用

## 要件の検証

### 要件5.1: 未認証リクエストの拒否 ✅
- Authorizationヘッダーが欠落している場合、HTTP 401レスポンスとWWW-Authenticateヘッダーを返す

### 要件5.2: WWW-Authenticateヘッダーの構造 ✅
- WWW-Authenticateヘッダーにrealmパラメータを含め、Protected Resource MetadataのURLを指定

### 要件5.3: JWT検証 ✅
- CognitoのJWKSを使用してJWT署名を検証
- issuer、audience、expirationクレームを検証

### 要件5.4: 有効なトークンの処理 ✅
- 有効なアクセストークンの場合、MCPリクエストを処理（タスク7で完全実装）

### 要件5.5: 無効なトークンの拒否 ✅
- 無効または期限切れのトークンの場合、HTTP 401レスポンスとWWW-Authenticateヘッダー（error=invalid_token）を返す

## 技術的な詳細

### 使用ライブラリ

- **jose**: JWT検証とJWKS処理
  - `createRemoteJWKSet()`: CognitoのJWKSエンドポイントからキーセットを取得
  - `jwtVerify()`: JWT署名とクレームを検証

### セキュリティ考慮事項

1. **JWKS取得**: CognitoのJWKSエンドポイントから公開鍵を動的に取得
2. **署名検証**: RS256アルゴリズムを使用した署名検証
3. **クレーム検証**: issuer、audience、expirationを厳密に検証
4. **エラーハンドリング**: 詳細なエラー情報を提供しつつ、セキュリティ情報の漏洩を防ぐ

### 環境変数

MCPハンドラーLambda関数で必要な環境変数：

```typescript
MCP_SERVER_URI: string          // MCPサーバーのURI
COGNITO_USER_POOL_ID: string    // Cognito User Pool ID
COGNITO_REGION: string          // AWSリージョン
COGNITO_CLIENT_ID: string       // Cognito Client ID
```

## デプロイ後の動作

1. MCPクライアントが`/mcp`エンドポイントにリクエストを送信
2. Lambda関数がAuthorizationヘッダーを確認
3. トークンが存在する場合、CognitoのJWKSを使用して検証
4. 検証成功: MCPリクエストを処理（タスク7で実装）
5. 検証失敗: 適切なエラーレスポンスを返却

## 次のステップ

タスク7「MCPサーバー - MCPプロトコルハンドラーの実装」で以下を実装します：

- JSON-RPC 2.0パーサー
- `tools/list`ハンドラー
- `tools/call`ハンドラー
- サンプルツール（echoツール）

## テスト実行

```bash
# すべてのテストを実行
npm test

# JWT middlewareのテストのみ実行
npm test src/mcp-server/__tests__/jwt-middleware.test.ts

# MCP handlerのテストのみ実行
npm test src/mcp-server/__tests__/mcp-handler.test.ts
```

## ファイル構成

```
src/mcp-server/
├── jwt-middleware.ts              # JWT検証ミドルウェア
├── mcp-handler.ts                 # MCPプロトコルハンドラー（JWT統合）
└── __tests__/
    ├── jwt-middleware.test.ts     # JWT middlewareのユニットテスト
    └── mcp-handler.test.ts        # MCP handlerのユニットテスト

lib/
└── authenticated-mcp-stack.ts     # CDKスタック（MCP handler Lambda追加）

docs/
└── TASK_6_IMPLEMENTATION_SUMMARY.md  # このドキュメント
```
