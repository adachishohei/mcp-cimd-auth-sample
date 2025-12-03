# 設計ドキュメント

## 概要

本システムは、MCP仕様のClient ID Metadata Documents方式を使用した認証機能を持つリモートMCPサーバーです。API Gateway + Lambdaで認可プロキシを実装し、Amazon Cognitoでユーザー認証とトークン発行を行い、MCPサーバーでトークン検証とツール提供を行います。

## アーキテクチャ

### システム構成図

```
┌─────────────────┐
│  MCPクライアント  │
│  (Kiro IDE等)   │
└────────┬────────┘
         │
         │ (1) 認可リクエスト
         │     client_id=URL, PKCE
         ↓
┌─────────────────────────────┐
│   認可プロキシ                │
│   (API Gateway + Lambda)    │
│   - /authorize              │
│   - /token                  │
└────────┬────────────────────┘
         │
         │ (2) Client ID Metadata
         │     Document取得・検証
         │
         │ (3) Cognito Managed UI
         │     にリダイレクト
         ↓
┌─────────────────────────────┐
│   Amazon Cognito            │
│   - User Pool               │
│   - Managed UI              │
│   - Token発行               │
└────────┬────────────────────┘
         │
         │ (4) 認可コード返却
         │     (MCPクライアントへ)
         │
         ↓
┌─────────────────┐
│  MCPクライアント  │
└────────┬────────┘
         │
         │ (5) トークンリクエスト
         │     code + PKCE
         ↓
┌─────────────────────────────┐
│   認可プロキシ                │
└────────┬────────────────────┘
         │
         │ (6) Cognitoトークン
         │     エンドポイント呼び出し
         ↓
┌─────────────────────────────┐
│   Amazon Cognito            │
└────────┬────────────────────┘
         │
         │ (7) アクセストークン返却
         ↓
┌─────────────────┐
│  MCPクライアント  │
└────────┬────────┘
         │
         │ (8) MCP リクエスト
         │     Bearer トークン
         ↓
┌─────────────────────────────┐
│   MCPサーバー                │
│   (API Gateway + Lambda)    │
│   - Protected Resource      │
│     Metadata                │
│   - Token検証               │
│   - MCPツール               │
└─────────────────────────────┘
```

### コンポーネント

1. **認可プロキシ（API Gateway + Lambda）**
   - Client ID Metadata Documentsの処理
   - OAuth 2.1認可フローの管理
   - PKCE検証

2. **Amazon Cognito**
   - ユーザー認証（Managed UI）
   - アクセストークン・リフレッシュトークンの発行

3. **MCPサーバー（API Gateway + Lambda）**
   - Protected Resource Metadataの公開
   - アクセストークンの検証
   - MCPツールの提供

## コンポーネントとインターフェース

### 認可プロキシ

#### 認可エンドポイント（/authorize）

**リクエスト:**
```
GET /authorize?
  response_type=code&
  client_id=https://example.com/client.json&
  redirect_uri=http://localhost:3000/callback&
  code_challenge=XXXX&
  code_challenge_method=S256&
  resource=https://mcp-server.example.com&
  scope=mcp:tools
```

**処理フロー:**
1. client_id（URL）からClient ID Metadata Documentを取得
2. ドキュメント内のclient_idとURLの一致を検証
3. redirect_uriがドキュメント内のredirect_urisに含まれることを検証
4. code_challengeとstateをセッションに保存
5. Cognito Managed UIにリダイレクト

**レスポンス:**
```
HTTP/1.1 302 Found
Location: https://cognito-domain.auth.region.amazoncognito.com/oauth2/authorize?...
```

#### トークンエンドポイント（/token）

**リクエスト:**
```
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTH_CODE&
redirect_uri=http://localhost:3000/callback&
client_id=https://example.com/client.json&
code_verifier=XXXX
```

**処理フロー:**
1. セッションからcode_challengeを取得
2. code_verifierからcode_challengeを計算して検証
3. Cognitoのトークンエンドポイントを呼び出し
4. アクセストークンを取得してクライアントに返却

**レスポンス:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJjdH..."
}
```

### MCPサーバー

#### Protected Resource Metadataエンドポイント

**リクエスト:**
```
GET /.well-known/oauth-protected-resource
```

**レスポンス:**
```json
{
  "resource": "https://mcp-server.example.com",
  "authorization_servers": [
    "https://auth-proxy.example.com"
  ],
  "scopes_supported": [
    "mcp:tools"
  ]
}
```

#### MCPエンドポイント

**リクエスト:**
```
POST /mcp
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

**処理フロー:**
1. Authorizationヘッダーからトークンを抽出
2. CognitoのJWKSを使用してトークンを検証
3. MCPリクエストを処理
4. レスポンスを返却

**レスポンス:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "echo",
        "description": "Echo back the input",
        "inputSchema": {
          "type": "object",
          "properties": {
            "message": {
              "type": "string"
            }
          }
        }
      }
    ]
  },
  "id": 1
}
```

## データモデル

### Client ID Metadata Document

```typescript
interface ClientMetadata {
  client_id: string;           // HTTPS URL
  client_name: string;
  client_uri?: string;
  logo_uri?: string;
  redirect_uris: string[];
  grant_types: string[];       // ["authorization_code"]
  response_types: string[];    // ["code"]
  token_endpoint_auth_method: string; // "none"
}
```

### Protected Resource Metadata

```typescript
interface ProtectedResourceMetadata {
  resource: string;            // MCPサーバーの正規URI
  authorization_servers: string[]; // 認可サーバーのIssuer URL
  scopes_supported: string[];  // サポートするスコープ
}
```

### セッションデータ

```typescript
interface AuthSession {
  code_challenge: string;
  code_challenge_method: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  created_at: number;
}
```

### MCPツール定義

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}
```

## エラーハンドリング

### 認可プロキシのエラー

1. **Client ID Metadata Document取得失敗**
   - HTTPステータス: 400 Bad Request
   - エラーコード: invalid_client
   - 説明: client_id URLからメタデータを取得できない

2. **client_id不一致**
   - HTTPステータス: 400 Bad Request
   - エラーコード: invalid_client
   - 説明: メタデータ内のclient_idとURLが一致しない

3. **redirect_uri検証失敗**
   - HTTPステータス: 400 Bad Request
   - エラーコード: invalid_request
   - 説明: redirect_uriがメタデータ内のredirect_urisに含まれない

4. **PKCE検証失敗**
   - HTTPステータス: 400 Bad Request
   - エラーコード: invalid_grant
   - 説明: code_verifierが無効

### MCPサーバーのエラー

1. **トークン欠落**
   - HTTPステータス: 401 Unauthorized
   - WWW-Authenticate: Bearer realm="/.well-known/oauth-protected-resource"

2. **トークン無効**
   - HTTPステータス: 401 Unauthorized
   - WWW-Authenticate: Bearer error="invalid_token", error_description="Token is invalid or expired"

3. **スコープ不足**
   - HTTPステータス: 403 Forbidden
   - エラー: insufficient_scope

## テスト戦略

### ユニットテスト

1. **Client ID Metadata Document検証**
   - 有効なメタデータの検証
   - client_id不一致の検出
   - redirect_uri検証

2. **PKCE検証**
   - code_verifierとcode_challengeの検証
   - 無効なcode_verifierの拒否

3. **JWT検証**
   - 有効なトークンの検証
   - 期限切れトークンの拒否
   - 無効な署名の拒否

### 統合テスト

1. **認可フロー全体**
   - MCPクライアントから認可リクエスト
   - Cognito Managed UIでの認証
   - トークン取得
   - MCPサーバーへのアクセス

2. **エラーケース**
   - 無効なclient_id
   - 無効なredirect_uri
   - 無効なPKCE
   - 無効なトークン


## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において真であるべき特性または動作です。本質的には、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。*

### プロパティ1: Client ID Metadata Document取得

*任意の*URL形式のclient_idに対して、認可プロキシが認可リクエストを受け取ったとき、そのURLからClient ID Metadata Documentを取得しようと試みなければならない
**検証: 要件 1.2**

### プロパティ2: client_id一致検証

*任意の*Client ID Metadata Documentに対して、ドキュメント内のclient_idフィールドがリクエストのclient_id URLと完全に一致しない場合、認可プロキシはエラーを返さなければならない
**検証: 要件 1.3**

### プロパティ3: redirect_uri検証

*任意の*redirect_uriとClient ID Metadata Documentに対して、redirect_uriがドキュメント内のredirect_uris配列に含まれない場合、認可プロキシはエラーを返さなければならない
**検証: 要件 1.4**

### プロパティ4: 認可成功時のリダイレクト

*任意の*有効な認可リクエストに対して、すべての検証が成功した場合、認可プロキシはCognito Managed UIへのリダイレクトレスポンス（HTTP 302）を返さなければならない
**検証: 要件 1.5**

### プロパティ5: PKCE検証

*任意の*code_verifierとcode_challengeのペアに対して、SHA256(code_verifier)がcode_challengeと一致しない場合、トークンエンドポイントはエラーを返さなければならない
**検証: 要件 2.2, 2.5**

### プロパティ6: PKCE成功時のトークン取得

*任意の*有効なトークンリクエストに対して、PKCE検証が成功した場合、認可プロキシはCognitoのトークンエンドポイントを呼び出し、取得したトークンをクライアントに返さなければならない
**検証: 要件 2.3, 2.4**

### プロパティ7: 未認証リクエストの拒否

*任意の*MCPリクエストに対して、Authorizationヘッダーが欠落している場合、MCPサーバーはHTTP 401レスポンスとWWW-Authenticateヘッダーを返さなければならない
**検証: 要件 5.1, 6.4**

### プロパティ8: WWW-Authenticateヘッダーの構造

*任意の*401レスポンスに対して、WWW-Authenticateヘッダーはrealmパラメータを含み、Protected Resource MetadataのURLを指定しなければならない
**検証: 要件 5.2**

### プロパティ9: JWT検証

*任意の*JWTトークンに対して、MCPサーバーはCognitoのJWKSを使用して署名を検証し、クレーム（issuer, audience, expiration）を検証しなければならない
**検証: 要件 5.3**

### プロパティ10: 有効なトークンの処理

*任意の*有効なアクセストークン付きMCPリクエストに対して、MCPサーバーはリクエストを処理し、適切なレスポンスを返さなければならない
**検証: 要件 5.4**

### プロパティ11: 無効なトークンの拒否

*任意の*無効または期限切れのトークンに対して、MCPサーバーはHTTP 401レスポンスとWWW-Authenticateヘッダー（error=invalid_token）を返さなければならない
**検証: 要件 5.5**

### プロパティ12: ツールリストの返却

*任意の*有効なトークン付きtools/listリクエストに対して、MCPサーバーはツール定義の配列を返さなければならない
**検証: 要件 6.2**

### プロパティ13: ツール実行

*任意の*有効なトークン付きtools/callリクエストに対して、MCPサーバーは指定されたツールを実行し、結果を返さなければならない
**検証: 要件 6.3**
