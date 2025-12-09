# Authorization Server Metadata

## 概要

Authorization Server Metadataエンドポイントは、OAuth 2.0認可サーバーの設定情報を提供します。これにより、MCPクライアントは認可サーバーのエンドポイントと機能を自動的に検出できます。

## 仕様

- **RFC**: [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- **エンドポイント**: `/.well-known/oauth-authorization-server`
- **メソッド**: GET
- **認証**: 不要（公開エンドポイント）

## エンドポイント

```
GET /.well-known/oauth-authorization-server
```

### レスポンス例

```json
{
  "issuer": "https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod",
  "authorization_endpoint": "https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/authorize",
  "token_endpoint": "https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/token",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["openid", "email", "profile"]
}
```

### フィールドの説明

| フィールド | 説明 |
|-----------|------|
| `issuer` | 認可サーバーの識別子（ベースURL） |
| `authorization_endpoint` | 認可エンドポイントのURL |
| `token_endpoint` | トークンエンドポイントのURL |
| `response_types_supported` | サポートするレスポンスタイプ（`code`のみ） |
| `grant_types_supported` | サポートする認可グラントタイプ |
| `code_challenge_methods_supported` | サポートするPKCEチャレンジメソッド（`S256`のみ） |
| `token_endpoint_auth_methods_supported` | トークンエンドポイントの認証方法（`none` = 公開クライアント） |
| `scopes_supported` | サポートするOAuthスコープ |

## 使用例

### curlでの取得

```bash
curl https://YOUR_AUTH_PROXY_URL/.well-known/oauth-authorization-server
```

### MCPクライアントでの使用

MCPクライアントは、このエンドポイントから取得した情報を使用して、認可フローを自動的に設定できます：

1. `authorization_endpoint`を使用して認可リクエストを開始
2. `token_endpoint`を使用してトークンを取得
3. `code_challenge_methods_supported`を確認してPKCE（S256）を使用

## MCP仕様との関係

MCP仕様では、クライアントが認可サーバーを検出する際に、以下の順序でメタデータエンドポイントを試行します：

1. **OAuth 2.0 Authorization Server Metadata** (このエンドポイント)
   - `/.well-known/oauth-authorization-server`
2. **OpenID Connect Discovery**
   - `/.well-known/openid-configuration`

本実装では、OAuth 2.0 Authorization Server Metadataを提供しています。

## キャッシング

レスポンスは1時間キャッシュされます（`Cache-Control: public, max-age=3600`）。

## CORS

このエンドポイントはCORSを有効にしており、任意のオリジンからアクセス可能です（`Access-Control-Allow-Origin: *`）。

## 実装詳細

- **Lambda関数**: `src/auth-proxy/auth-server-metadata.ts`
- **テスト**: `src/auth-proxy/__tests__/auth-server-metadata.test.ts`
- **CDK定義**: `lib/authenticated-mcp-stack.ts`

## 関連ドキュメント

- [Authorization Endpoint](AUTHORIZE_ENDPOINT.md)
- [Token Endpoint](TOKEN_ENDPOINT.md)
- [Protected Resource Metadata](API_REFERENCE.md#protected-resource-metadata)
