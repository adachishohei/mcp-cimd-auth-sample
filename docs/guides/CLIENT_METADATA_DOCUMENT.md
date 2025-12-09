# Client ID Metadata Document

## 概要

Client ID Metadata Documentは、MCPクライアントがホストする必要があるJSONドキュメントです。認可プロキシは、認可リクエストの`client_id`パラメータ（HTTPS URL）からこのドキュメントを取得し、クライアントの正当性を検証します。

## 要件

- **HTTPS必須**: Client ID Metadata DocumentはHTTPS URLでホストされなければなりません
- **公開アクセス可能**: 認可プロキシがアクセスできる必要があります
- **Content-Type**: `application/json`で提供する必要があります

## ドキュメント構造

```json
{
  "client_id": "https://example.com/client.json",
  "client_name": "My MCP Client",
  "client_uri": "https://example.com",
  "logo_uri": "https://example.com/logo.png",
  "redirect_uris": [
    "http://localhost:3000/callback",
    "https://app.example.com/callback"
  ],
  "grant_types": [
    "authorization_code"
  ],
  "response_types": [
    "code"
  ],
  "token_endpoint_auth_method": "none"
}
```

## フィールド説明

### 必須フィールド

- **client_id** (string): クライアントID。このドキュメントのHTTPS URLと完全に一致する必要があります
- **redirect_uris** (array of strings): 許可されたリダイレクトURIのリスト

### 推奨フィールド

- **client_name** (string): クライアントの人間が読める名前
- **grant_types** (array of strings): サポートするグラントタイプ（通常は`["authorization_code"]`）
- **response_types** (array of strings): サポートするレスポンスタイプ（通常は`["code"]`）
- **token_endpoint_auth_method** (string): トークンエンドポイント認証メソッド（PKCE使用時は`"none"`）

### オプションフィールド

- **client_uri** (string): クライアントのホームページURL
- **logo_uri** (string): クライアントのロゴ画像URL

## 検証ルール

認可プロキシは以下を検証します：

1. **client_id一致**: ドキュメント内の`client_id`フィールドが、リクエストの`client_id`パラメータ（URL）と完全に一致すること
2. **redirect_uri検証**: リクエストの`redirect_uri`が、ドキュメント内の`redirect_uris`配列に含まれること

## ホスティング方法

### 静的ファイルとしてホスト

最も簡単な方法は、静的ファイルとしてホストすることです：

```bash
# 例: Nginxで静的ファイルをホスト
server {
    listen 443 ssl;
    server_name example.com;
    
    location /client.json {
        root /var/www/html;
        add_header Content-Type application/json;
        add_header Access-Control-Allow-Origin *;
    }
}
```

### API Gatewayでホスト（AWS）

AWS API Gatewayを使用してホストする場合：

```typescript
// Lambda関数
export async function handler(event: APIGatewayProxyEvent) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      client_id: 'https://api.example.com/client.json',
      client_name: 'My MCP Client',
      redirect_uris: [
        'http://localhost:3000/callback',
        'https://app.example.com/callback',
      ],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  };
}
```

### GitHub Pagesでホスト

開発環境では、GitHub Pagesを使用することもできます：

1. リポジトリに`client.json`を配置
2. GitHub Pagesを有効化
3. `https://username.github.io/repo/client.json`としてアクセス可能

## セキュリティ考慮事項

1. **HTTPS必須**: Client ID Metadata DocumentはHTTPSでホストする必要があります
2. **redirect_urisの制限**: 信頼できるリダイレクトURIのみを含めてください
3. **定期的な更新**: redirect_urisを変更する場合は、ドキュメントを更新してください
4. **アクセスログ**: 不正なアクセスを検出するため、アクセスログを監視してください

## 使用例

### 認可リクエスト

```http
GET /authorize?
  response_type=code&
  client_id=https://example.com/client.json&
  redirect_uri=http://localhost:3000/callback&
  code_challenge=XXXX&
  code_challenge_method=S256&
  scope=mcp:tools
```

認可プロキシは以下を実行します：

1. `https://example.com/client.json`からClient ID Metadata Documentを取得
2. ドキュメント内の`client_id`が`https://example.com/client.json`と一致することを確認
3. `redirect_uri`（`http://localhost:3000/callback`）が`redirect_uris`配列に含まれることを確認
4. 検証が成功したら、Cognito Managed UIにリダイレクト

## トラブルシューティング

### エラー: "Failed to fetch client metadata"

- Client ID Metadata DocumentのURLがHTTPSであることを確認
- URLが公開アクセス可能であることを確認
- Content-Typeが`application/json`であることを確認

### エラー: "client_id mismatch"

- ドキュメント内の`client_id`フィールドが、ホストしているURLと完全に一致することを確認
- 末尾のスラッシュなど、細かい違いにも注意

### エラー: "redirect_uri not found in client metadata"

- リクエストの`redirect_uri`が、ドキュメント内の`redirect_uris`配列に含まれることを確認
- URLは完全一致である必要があります（スキーム、ホスト、ポート、パスすべて）

## 参考資料

- [MCP Specification - Client ID Metadata Documents](https://spec.modelcontextprotocol.io/)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [RFC 7591 - OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591)
