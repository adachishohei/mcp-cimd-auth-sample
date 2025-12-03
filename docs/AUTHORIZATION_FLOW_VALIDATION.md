# 認可フロー検証レポート

## 検証日時
2024年12月

## 検証対象
MCP Client ID Metadata Documents方式による認可フローの実装

## MCP仕様の要件

### Client ID Metadata Documents
MCP仕様（2025-11-25）では、以下を要求しています：

1. **Client ID Metadata Document**をHTTPS URLでホスト
2. 認可サーバーは`client_id`（URL）からメタデータを取得
3. メタデータ内の`client_id`とURLが一致することを検証
4. `redirect_uri`がメタデータ内の`redirect_uris`に含まれることを検証

参照: [OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00)

## 現在の実装の問題点

### 🔴 重大な問題: リダイレクトフローの不整合

#### 現在の実装
```
1. MCP Client → Auth Proxy (/authorize)
   - client_id, redirect_uri, code_challenge等を送信
   
2. Auth Proxy → Cognito Managed UI
   - redirect_uri = MCP Client's redirect_uri ❌ 間違い
   
3. Cognito → MCP Client's redirect_uri
   - 認可コードを直接MCPクライアントに返す
   
4. MCP Client → Auth Proxy (/token)
   - 認可コードとcode_verifierを送信
```

#### 問題点
- **Cognitoの`redirect_uri`にMCPクライアントのURIを設定している**
- CognitoのUser Pool Clientに登録されていないredirect_uriは拒否される
- 動的なMCPクライアントのredirect_uriをすべて事前登録することは不可能

#### 正しいフロー（OAuth 2.1 + PKCE）
```
1. MCP Client → Auth Proxy (/authorize)
   - client_id, redirect_uri, code_challenge等を送信
   
2. Auth Proxy → Cognito Managed UI
   - redirect_uri = Auth Proxy's callback URL ✅ 正しい
   - state = sessionId (セッション識別用)
   
3. Cognito → Auth Proxy (/callback)
   - 認可コードをAuth Proxyに返す
   - state = sessionId
   
4. Auth Proxy → MCP Client's redirect_uri
   - 認可コードをMCPクライアントに転送
   - state = 元のstate値
   
5. MCP Client → Auth Proxy (/token)
   - 認可コードとcode_verifierを送信
```

### 🟡 その他の問題

#### 1. Cognitoコールバックエンドポイントの欠如
- `/callback`エンドポイントが実装されていない
- Cognitoからの認可コードを受け取る仕組みがない

#### 2. セッション管理の不完全性
- セッションにMCPクライアントの元の`state`値が保存されていない
- MCPクライアントに返すべき`state`値が失われる

#### 3. Cognitoの設定
- User Pool Clientの`callback_urls`に認可プロキシのコールバックURLを登録する必要がある

## 修正提案

### 1. `/callback`エンドポイントの追加

新しいLambda関数を作成：`src/auth-proxy/callback.ts`

```typescript
/**
 * Cognito callback handler
 * Receives authorization code from Cognito and redirects to MCP client
 */
export async function handler(event: APIGatewayProxyEvent) {
  const params = event.queryStringParameters || {};
  const code = params.code;
  const state = params.state; // sessionId
  const error = params.error;

  if (error) {
    // Handle Cognito error
    return redirectToClient(session.redirect_uri, {
      error,
      error_description: params.error_description,
      state: session.state,
    });
  }

  // Retrieve session
  const session = await retrieveSession(state);
  
  if (!session) {
    return errorResponse('invalid_request', 'Invalid session');
  }

  // Redirect to MCP client with authorization code
  return {
    statusCode: 302,
    headers: {
      Location: buildRedirectUrl(session.redirect_uri, {
        code,
        state: session.state, // 元のstate値
      }),
    },
    body: '',
  };
}
```

### 2. `authorize.ts`の修正

```typescript
// Cognitoへのリダイレクト時に、Auth ProxyのコールバックURLを使用
function buildCognitoAuthUrl(config, params) {
  const authProxyCallbackUrl = `${config.authProxyBaseUrl}/callback`;
  
  const queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: config.cognitoClientId,
    redirect_uri: authProxyCallbackUrl, // ✅ Auth Proxyのコールバック
    scope: params.scope || 'openid email profile mcp-server/tools',
    state: params.sessionId, // セッションID
  });

  return `${cognitoBaseUrl}?${queryParams.toString()}`;
}
```

### 3. セッションデータの拡張

```typescript
interface AuthSession {
  code_challenge: string;
  code_challenge_method: string;
  client_id: string;
  redirect_uri: string;
  state: string; // MCPクライアントから受け取った元のstate
  created_at: number;
  ttl: number;
}
```

### 4. CDKスタックの更新

```typescript
// Cognitoコールバック用のLambda関数
const callbackFunction = new nodejs.NodejsFunction(this, 'CallbackFunction', {
  entry: path.join(__dirname, '../src/auth-proxy/callback.ts'),
  // ...
});

// /callbackエンドポイントの追加
const callbackResource = authProxyApi.root.addResource('callback');
callbackResource.addMethod('GET', new apigateway.LambdaIntegration(callbackFunction));

// Cognito User Pool Clientの更新
this.userPoolClient = this.userPool.addClient('McpUserPoolClient', {
  // ...
  oAuth: {
    // ...
    callbackUrls: [
      `${authProxyApi.url}callback`, // ✅ Auth Proxyのコールバック
    ],
  },
});
```

## VS Code MCP Clientとの互換性

VS Code MCP Clientは、標準的なOAuth 2.1フローを期待しています：

1. ✅ Client ID Metadata Documentsのサポート
2. ✅ PKCE (S256)の使用
3. ✅ 認可コードフロー
4. ❌ **リダイレクトフローが現在の実装と不整合**

修正後は、VS Code MCP Clientと完全に互換性があります。

## ネットワーク通信フロー（修正後）

```
┌─────────────┐
│ MCP Client  │
│ (VS Code)   │
└──────┬──────┘
       │
       │ (1) GET /authorize
       │     ?client_id=https://client.example.com/metadata.json
       │     &redirect_uri=vscode://callback
       │     &code_challenge=xxx
       │     &code_challenge_method=S256
       │     &state=client-state-123
       ↓
┌─────────────────────┐
│  Auth Proxy         │
│  /authorize         │
└──────┬──────────────┘
       │
       │ (2) Fetch Client ID Metadata Document
       │     GET https://client.example.com/metadata.json
       │
       │ (3) Validate metadata
       │     - client_id matches URL
       │     - redirect_uri in redirect_uris
       │
       │ (4) Store session in DynamoDB
       │     sessionId → {code_challenge, redirect_uri, state, ...}
       │
       │ (5) 302 Redirect to Cognito
       │     Location: https://cognito.../oauth2/authorize
       │     ?redirect_uri=https://auth-proxy.../callback
       │     &state=sessionId
       ↓
┌─────────────────────┐
│  Cognito Managed UI │
└──────┬──────────────┘
       │
       │ (6) User authenticates
       │
       │ (7) 302 Redirect to Auth Proxy
       │     Location: https://auth-proxy.../callback
       │     ?code=cognito-auth-code
       │     &state=sessionId
       ↓
┌─────────────────────┐
│  Auth Proxy         │
│  /callback          │
└──────┬──────────────┘
       │
       │ (8) Retrieve session from DynamoDB
       │     sessionId → {redirect_uri, state, ...}
       │
       │ (9) 302 Redirect to MCP Client
       │     Location: vscode://callback
       │     ?code=cognito-auth-code
       │     &state=client-state-123
       ↓
┌─────────────┐
│ MCP Client  │
└──────┬──────┘
       │
       │ (10) POST /token
       │      code=cognito-auth-code
       │      &code_verifier=xxx
       │      &state=sessionId
       ↓
┌─────────────────────┐
│  Auth Proxy         │
│  /token             │
└──────┬──────────────┘
       │
       │ (11) Validate PKCE
       │      SHA256(code_verifier) == code_challenge
       │
       │ (12) Exchange code with Cognito
       │      POST https://cognito.../oauth2/token
       │
       │ (13) Return tokens to MCP Client
       │      {access_token, refresh_token, ...}
       ↓
┌─────────────┐
│ MCP Client  │
└─────────────┘
```

## 推奨事項

### 即座に修正が必要
1. ✅ `/callback`エンドポイントの実装
2. ✅ `authorize.ts`のリダイレクトURI修正
3. ✅ Cognito User Pool Clientの設定更新

### 追加の改善
1. エラーハンドリングの強化
2. セッションのタイムアウト処理
3. ログとモニタリングの追加

## 結論

**現在の実装は、MCP仕様のClient ID Metadata Documents方式に部分的に準拠していますが、リダイレクトフローに重大な問題があります。**

VS Code MCP Clientと正しく動作させるには、上記の修正が必須です。修正後は、MCP仕様とOAuth 2.1に完全に準拠した実装となります。
