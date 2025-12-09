# API リファレンス

このドキュメントは、認証付きMCPサーバーのすべてのAPIエンドポイントの詳細な仕様を提供します。

## 目次

1. [認可プロキシAPI](#認可プロキシapi)
   - [GET /authorize](#get-authorize)
   - [POST /token](#post-token)
2. [MCPサーバーAPI](#mcpサーバーapi)
   - [GET /.well-known/oauth-protected-resource](#get-well-knownoauth-protected-resource)
   - [POST /mcp](#post-mcp)
3. [エラーレスポンス](#エラーレスポンス)
4. [データ型](#データ型)

---

## 認可プロキシAPI

### GET /authorize

OAuth 2.1認可コードフローを開始します。Client ID Metadata Documentを検証し、Cognito Managed UIにリダイレクトします。

#### リクエスト

**エンドポイント**: `GET /authorize`

**クエリパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| `response_type` | string | ✓ | `code`を指定 |
| `client_id` | string | ✓ | Client ID Metadata DocumentのHTTPS URL |
| `redirect_uri` | string | ✓ | 認可コールバックURI |
| `code_challenge` | string | ✓ | PKCE code challenge（SHA256ハッシュ、base64url エンコード） |
| `code_challenge_method` | string | ✓ | `S256`を指定 |
| `state` | string | 推奨 | CSRF対策用のランダム文字列 |
| `scope` | string | オプション | 要求するスコープ（デフォルト: `mcp:tools`） |
| `resource` | string | オプション | MCPサーバーのURI |

**例**:

```http
GET /authorize?response_type=code&client_id=https://example.com/client.json&redirect_uri=http://localhost:3000/callback&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=xyz123&scope=mcp:tools&resource=https://mcp-server.example.com HTTP/1.1
Host: auth-proxy.example.com
```

#### レスポンス

**成功時（302 Found）**:

```http
HTTP/1.1 302 Found
Location: https://cognito-domain.auth.region.amazoncognito.com/oauth2/authorize?...
```

ユーザーはCognito Managed UIにリダイレクトされます。

**エラー時（400 Bad Request）**:

```json
{
  "error": "invalid_client",
  "error_description": "Failed to fetch client metadata from https://example.com/client.json"
}
```

#### エラーコード

| エラーコード | 説明 |
|------------|------|
| `invalid_request` | 必須パラメータが欠落または無効 |
| `invalid_client` | Client ID Metadata Documentの取得または検証に失敗 |
| `invalid_grant` | redirect_uriが許可されていない |

---

### POST /token

認可コードをアクセストークンに交換します。PKCE検証を実行します。

#### リクエスト

**エンドポイント**: `POST /token`

**ヘッダー**:

```
Content-Type: application/x-www-form-urlencoded
```

**ボディパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| `grant_type` | string | ✓ | `authorization_code`または`refresh_token` |
| `code` | string | ✓* | 認可コード（grant_type=authorization_codeの場合） |
| `redirect_uri` | string | ✓* | 認可リクエストで使用したredirect_uri |
| `client_id` | string | ✓ | Client ID Metadata DocumentのURL |
| `code_verifier` | string | ✓* | PKCE code verifier（grant_type=authorization_codeの場合） |
| `refresh_token` | string | ✓** | リフレッシュトークン（grant_type=refresh_tokenの場合） |

\* `grant_type=authorization_code`の場合に必須  
\** `grant_type=refresh_token`の場合に必須

**例（認可コード交換）**:

```http
POST /token HTTP/1.1
Host: auth-proxy.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=AUTH_CODE&redirect_uri=http://localhost:3000/callback&client_id=https://example.com/client.json&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

**例（トークンリフレッシュ）**:

```http
POST /token HTTP/1.1
Host: auth-proxy.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=REFRESH_TOKEN&client_id=https://example.com/client.json
```

#### レスポンス

**成功時（200 OK）**:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ..."
}
```

**フィールド説明**:

| フィールド | 型 | 説明 |
|----------|-----|------|
| `access_token` | string | JWT形式のアクセストークン |
| `token_type` | string | 常に`Bearer` |
| `expires_in` | number | トークンの有効期限（秒） |
| `refresh_token` | string | リフレッシュトークン（オプション） |

**エラー時（400 Bad Request）**:

```json
{
  "error": "invalid_grant",
  "error_description": "PKCE verification failed"
}
```

#### エラーコード

| エラーコード | 説明 |
|------------|------|
| `invalid_request` | 必須パラメータが欠落または無効 |
| `invalid_grant` | 認可コードまたはPKCE検証に失敗 |
| `invalid_client` | クライアント認証に失敗 |

---

## MCPサーバーAPI

### GET /.well-known/oauth-protected-resource

Protected Resource Metadataを返します。MCPクライアントが認可サーバー情報を検出するために使用します。

#### リクエスト

**エンドポイント**: `GET /.well-known/oauth-protected-resource`

**ヘッダー**: なし（認証不要）

**例**:

```http
GET /.well-known/oauth-protected-resource HTTP/1.1
Host: mcp-server.example.com
```

#### レスポンス

**成功時（200 OK）**:

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

**フィールド説明**:

| フィールド | 型 | 説明 |
|----------|-----|------|
| `resource` | string | MCPサーバーの正規URI |
| `authorization_servers` | string[] | 認可サーバーのIssuer URL配列 |
| `scopes_supported` | string[] | サポートするOAuthスコープ配列 |

---

### POST /mcp

MCPプロトコルリクエストを処理します。JSON-RPC 2.0形式を使用します。

#### リクエスト

**エンドポイント**: `POST /mcp`

**ヘッダー**:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**ボディ（JSON-RPC 2.0）**:

```json
{
  "jsonrpc": "2.0",
  "method": "<method_name>",
  "params": {},
  "id": 1
}
```

#### サポートされるメソッド

##### tools/list

利用可能なツールのリストを取得します。

**リクエスト例**:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

**レスポンス例**:

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

##### tools/call

指定されたツールを実行します。

**リクエスト例**:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": {
      "message": "Hello, MCP!"
    }
  },
  "id": 2
}
```

**レスポンス例**:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Echo: Hello, MCP!"
      }
    ]
  },
  "id": 2
}
```

#### エラーレスポンス

**認証エラー（401 Unauthorized）**:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="/.well-known/oauth-protected-resource"
Content-Type: application/json

{
  "error": "unauthorized",
  "message": "Missing or invalid authorization header"
}
```

**トークン無効（401 Unauthorized）**:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", error_description="Token is invalid or expired"
Content-Type: application/json

{
  "error": "invalid_token",
  "message": "Token is invalid or expired"
}
```

**JSON-RPCエラー（200 OK）**:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found"
  },
  "id": 1
}
```

---

## エラーレスポンス

### OAuth 2.1エラー

OAuth 2.1仕様に準拠したエラーレスポンス：

```json
{
  "error": "<error_code>",
  "error_description": "<human_readable_description>",
  "error_uri": "<optional_error_documentation_url>"
}
```

#### 標準エラーコード

| エラーコード | HTTPステータス | 説明 |
|------------|--------------|------|
| `invalid_request` | 400 | リクエストパラメータが無効または欠落 |
| `invalid_client` | 400 | クライアント認証に失敗 |
| `invalid_grant` | 400 | 認可コードまたはPKCE検証に失敗 |
| `unauthorized_client` | 400 | クライアントが認可されていない |
| `unsupported_grant_type` | 400 | サポートされていないgrant_type |
| `invalid_scope` | 400 | 無効または不明なスコープ |
| `access_denied` | 403 | ユーザーが認可を拒否 |
| `server_error` | 500 | サーバー内部エラー |

### JSON-RPCエラー

JSON-RPC 2.0仕様に準拠したエラーレスポンス：

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": <error_code>,
    "message": "<error_message>",
    "data": {}
  },
  "id": <request_id>
}
```

#### 標準エラーコード

| エラーコード | 説明 |
|------------|------|
| `-32700` | Parse error（JSONパースエラー） |
| `-32600` | Invalid Request（無効なリクエスト） |
| `-32601` | Method not found（メソッドが見つからない） |
| `-32602` | Invalid params（無効なパラメータ） |
| `-32603` | Internal error（内部エラー） |

---

## データ型

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

### JWT Access Token

アクセストークンはJWT形式で、以下のクレームを含みます：

```json
{
  "sub": "user-id",
  "iss": "https://cognito-idp.region.amazonaws.com/user-pool-id",
  "aud": "client-id",
  "exp": 1234567890,
  "iat": 1234564290,
  "token_use": "access",
  "scope": "openid email profile mcp-server/tools",
  "username": "user@example.com"
}
```

### MCP Tool Definition

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

### MCP Tool Result

```typescript
interface MCPToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}
```

---

## レート制限

現在、レート制限は実装されていませんが、API Gatewayのデフォルト制限が適用されます：

- **バーストレート**: 5,000リクエスト/秒
- **定常レート**: 10,000リクエスト/秒

本番環境では、適切なレート制限の設定を推奨します。

## バージョニング

現在のAPIバージョン: `v1`

APIバージョンはURLパスに含まれません。将来的な変更は後方互換性を維持するか、新しいエンドポイントとして提供されます。

## サポート

APIに関する質問や問題は、GitHubのIssuesで報告してください。
