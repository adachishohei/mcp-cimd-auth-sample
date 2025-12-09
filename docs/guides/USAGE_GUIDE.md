# 使用ガイド

このドキュメントは、認証付きMCPサーバーの実際の使用方法を詳しく説明します。

## 目次

1. [前提条件](#前提条件)
2. [初期セットアップ](#初期セットアップ)
3. [Client ID Metadata Documentの作成](#client-id-metadata-documentの作成)
4. [認証フローの実装](#認証フローの実装)
5. [MCPツールの使用](#mcpツールの使用)
6. [エラーハンドリング](#エラーハンドリング)
7. [実装例](#実装例)

## 前提条件

- デプロイ済みのMCPサーバー
- Cognito User Poolに登録されたテストユーザー
- Client ID Metadata DocumentをホストできるHTTPSサーバー

## 初期セットアップ

### 1. デプロイ情報の取得

デプロイ後、以下のコマンドでエンドポイント情報を取得：

```bash
./scripts/get-outputs.sh
```

または：

```bash
npm run outputs
```

以下の情報をメモしてください：

- `AuthProxyApiUrl`: 認可プロキシのベースURL
- `McpServerApiUrl`: MCPサーバーのベースURL
- `UserPoolId`: Cognito User Pool ID
- `UserPoolClientId`: Cognito Client ID
- `CognitoManagedUIUrl`: Cognito Managed UIのURL

### 2. 環境変数の設定

```bash
export AUTH_PROXY_URL="https://xxx.execute-api.us-east-1.amazonaws.com/prod"
export MCP_SERVER_URL="https://yyy.execute-api.us-east-1.amazonaws.com/prod"
export USER_POOL_ID="us-east-1_XXXXXXXXX"
export CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 3. テストユーザーの作成

```bash
./scripts/create-test-user.sh $USER_POOL_ID test@example.com TestPassword123!
```

## Client ID Metadata Documentの作成

### ドキュメント構造

Client ID Metadata Documentは、MCPクライアントの情報を含むJSONファイルです。HTTPS URLでホストする必要があります。

```json
{
  "client_id": "https://example.com/client.json",
  "client_name": "My MCP Client",
  "client_uri": "https://example.com",
  "logo_uri": "https://example.com/logo.png",
  "redirect_uris": [
    "http://localhost:3000/callback",
    "https://example.com/callback"
  ],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

### フィールドの説明

- **client_id** (必須): このドキュメントのHTTPS URL。ドキュメント内のclient_idとURLが完全に一致する必要があります
- **client_name** (必須): クライアントの表示名
- **client_uri** (オプション): クライアントのホームページURL
- **logo_uri** (オプション): クライアントのロゴ画像URL
- **redirect_uris** (必須): 認可コールバックを受け取るURI配列
- **grant_types** (必須): `["authorization_code"]`を指定
- **response_types** (必須): `["code"]`を指定
- **token_endpoint_auth_method** (必須): `"none"`を指定（パブリッククライアント）

### ホスティング方法

#### 方法1: GitHub Pages

```bash
# リポジトリのルートにclient.jsonを作成
echo '{
  "client_id": "https://yourusername.github.io/your-repo/client.json",
  "client_name": "My MCP Client",
  "redirect_uris": ["http://localhost:3000/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}' > client.json

# GitHub Pagesを有効化
# Settings > Pages > Source: main branch
```

#### 方法2: 静的ホスティングサービス

- Netlify
- Vercel
- AWS S3 + CloudFront

#### 方法3: 開発用ローカルサーバー（HTTPSが必要）

```bash
# ngrokを使用してローカルサーバーをHTTPS化
npx http-server . -p 8080
ngrok http 8080

# ngrokが提供するHTTPS URLを使用
# https://xxxx.ngrok.io/client.json
```

## 認証フローの実装

### ステップ1: PKCEパラメータの生成

```javascript
// Node.js実装例
const crypto = require('crypto');

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  return base64URLEncode(
    crypto.createHash('sha256').update(verifier).digest()
  );
}

function base64URLEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// 使用例
const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);

console.log('Code Verifier:', codeVerifier);
console.log('Code Challenge:', codeChallenge);

// code_verifierを安全に保存（セッションストレージなど）
sessionStorage.setItem('code_verifier', codeVerifier);
```

### ステップ2: 認可リクエストの構築

```javascript
function buildAuthorizationUrl(config) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_challenge: config.codeChallenge,
    code_challenge_method: 'S256',
    state: config.state,
    scope: 'mcp:tools',
    resource: config.mcpServerUrl
  });

  return `${config.authProxyUrl}/authorize?${params.toString()}`;
}

// 使用例
const authUrl = buildAuthorizationUrl({
  authProxyUrl: process.env.AUTH_PROXY_URL,
  clientId: 'https://example.com/client.json',
  redirectUri: 'http://localhost:3000/callback',
  codeChallenge: codeChallenge,
  state: crypto.randomBytes(16).toString('hex'),
  mcpServerUrl: process.env.MCP_SERVER_URL
});

console.log('Authorization URL:', authUrl);
// ユーザーをこのURLにリダイレクト
```

### ステップ3: コールバックの処理

```javascript
// コールバックURLからパラメータを取得
function handleCallback(callbackUrl) {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    throw new Error(`Authorization error: ${error}`);
  }

  // stateパラメータの検証（CSRF対策）
  const savedState = sessionStorage.getItem('state');
  if (state !== savedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  return code;
}
```

### ステップ4: トークン交換

```javascript
async function exchangeCodeForToken(code, config) {
  const codeVerifier = sessionStorage.getItem('code_verifier');
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier
  });

  const response = await fetch(`${config.authProxyUrl}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description}`);
  }

  const tokens = await response.json();
  
  // トークンを安全に保存
  sessionStorage.setItem('access_token', tokens.access_token);
  sessionStorage.setItem('refresh_token', tokens.refresh_token);
  
  return tokens;
}

// 使用例
const tokens = await exchangeCodeForToken(authCode, {
  authProxyUrl: process.env.AUTH_PROXY_URL,
  clientId: 'https://example.com/client.json',
  redirectUri: 'http://localhost:3000/callback'
});

console.log('Access Token:', tokens.access_token);
```

## MCPツールの使用

### Protected Resource Metadataの取得

```javascript
async function getProtectedResourceMetadata(mcpServerUrl) {
  const response = await fetch(
    `${mcpServerUrl}/.well-known/oauth-protected-resource`
  );
  
  return await response.json();
}

// 使用例
const metadata = await getProtectedResourceMetadata(process.env.MCP_SERVER_URL);
console.log('Authorization Servers:', metadata.authorization_servers);
console.log('Supported Scopes:', metadata.scopes_supported);
```

### ツールリストの取得

```javascript
async function listTools(mcpServerUrl, accessToken) {
  const response = await fetch(`${mcpServerUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to list tools: ${response.status}`);
  }

  const result = await response.json();
  return result.result.tools;
}

// 使用例
const accessToken = sessionStorage.getItem('access_token');
const tools = await listTools(process.env.MCP_SERVER_URL, accessToken);

tools.forEach(tool => {
  console.log(`Tool: ${tool.name}`);
  console.log(`Description: ${tool.description}`);
  console.log(`Input Schema:`, tool.inputSchema);
});
```

### ツールの実行

```javascript
async function callTool(mcpServerUrl, accessToken, toolName, args) {
  const response = await fetch(`${mcpServerUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id: 2
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to call tool: ${response.status}`);
  }

  const result = await response.json();
  return result.result;
}

// 使用例: echoツールの実行
const result = await callTool(
  process.env.MCP_SERVER_URL,
  accessToken,
  'echo',
  { message: 'Hello, MCP!' }
);

console.log('Tool Result:', result);
```

## エラーハンドリング

### 認可エラー

```javascript
function handleAuthorizationError(error) {
  switch (error.error) {
    case 'invalid_client':
      console.error('Client ID Metadata Document is invalid or inaccessible');
      break;
    case 'invalid_request':
      console.error('Invalid authorization request parameters');
      break;
    case 'access_denied':
      console.error('User denied authorization');
      break;
    default:
      console.error('Unknown authorization error:', error);
  }
}
```

### トークンエラー

```javascript
function handleTokenError(error) {
  switch (error.error) {
    case 'invalid_grant':
      console.error('Authorization code or PKCE verification failed');
      break;
    case 'invalid_client':
      console.error('Client authentication failed');
      break;
    default:
      console.error('Unknown token error:', error);
  }
}
```

### API エラー

```javascript
async function handleApiError(response) {
  if (response.status === 401) {
    const wwwAuth = response.headers.get('WWW-Authenticate');
    console.error('Authentication required:', wwwAuth);
    
    // トークンをリフレッシュまたは再認証
    await refreshToken();
  } else if (response.status === 403) {
    console.error('Insufficient permissions');
  } else {
    const error = await response.json();
    console.error('API error:', error);
  }
}
```

### トークンリフレッシュ

```javascript
async function refreshToken(config) {
  const refreshToken = sessionStorage.getItem('refresh_token');
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId
  });

  const response = await fetch(`${config.authProxyUrl}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    // リフレッシュトークンが無効な場合は再認証が必要
    throw new Error('Refresh token expired - re-authentication required');
  }

  const tokens = await response.json();
  sessionStorage.setItem('access_token', tokens.access_token);
  
  return tokens;
}
```

## 実装例

### 完全なクライアント実装例

```javascript
class MCPClient {
  constructor(config) {
    this.authProxyUrl = config.authProxyUrl;
    this.mcpServerUrl = config.mcpServerUrl;
    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
  }

  // 認証フローの開始
  startAuthFlow() {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString('hex');

    // セッションに保存
    sessionStorage.setItem('code_verifier', codeVerifier);
    sessionStorage.setItem('state', state);

    // 認可URLを構築
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
      scope: 'mcp:tools',
      resource: this.mcpServerUrl
    });

    const authUrl = `${this.authProxyUrl}/authorize?${params.toString()}`;
    
    // ユーザーをリダイレクト
    window.location.href = authUrl;
  }

  // コールバック処理
  async handleCallback(callbackUrl) {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    // State検証
    const savedState = sessionStorage.getItem('state');
    if (state !== savedState) {
      throw new Error('State mismatch');
    }

    // トークン交換
    const tokens = await this.exchangeCodeForToken(code);
    return tokens;
  }

  // トークン交換
  async exchangeCodeForToken(code) {
    const codeVerifier = sessionStorage.getItem('code_verifier');
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier
    });

    const response = await fetch(`${this.authProxyUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const tokens = await response.json();
    sessionStorage.setItem('access_token', tokens.access_token);
    sessionStorage.setItem('refresh_token', tokens.refresh_token);
    
    return tokens;
  }

  // MCPリクエスト
  async request(method, params = {}) {
    const accessToken = sessionStorage.getItem('access_token');
    
    const response = await fetch(`${this.mcpServerUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: Date.now()
      })
    });

    if (response.status === 401) {
      // トークンリフレッシュを試行
      await this.refreshToken();
      // リクエストを再試行
      return this.request(method, params);
    }

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.result;
  }

  // ツールリスト取得
  async listTools() {
    return this.request('tools/list');
  }

  // ツール実行
  async callTool(name, args) {
    return this.request('tools/call', { name, arguments: args });
  }

  // トークンリフレッシュ
  async refreshToken() {
    const refreshToken = sessionStorage.getItem('refresh_token');
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId
    });

    const response = await fetch(`${this.authProxyUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      // 再認証が必要
      this.startAuthFlow();
      throw new Error('Re-authentication required');
    }

    const tokens = await response.json();
    sessionStorage.setItem('access_token', tokens.access_token);
  }

  // ヘルパーメソッド
  generateCodeVerifier() {
    return base64URLEncode(crypto.randomBytes(32));
  }

  generateCodeChallenge(verifier) {
    return base64URLEncode(
      crypto.createHash('sha256').update(verifier).digest()
    );
  }
}

// 使用例
const client = new MCPClient({
  authProxyUrl: 'https://xxx.execute-api.us-east-1.amazonaws.com/prod',
  mcpServerUrl: 'https://yyy.execute-api.us-east-1.amazonaws.com/prod',
  clientId: 'https://example.com/client.json',
  redirectUri: 'http://localhost:3000/callback'
});

// 認証開始
client.startAuthFlow();

// コールバック処理（リダイレクト後）
await client.handleCallback(window.location.href);

// ツール使用
const tools = await client.listTools();
const result = await client.callTool('echo', { message: 'Hello!' });
```

### curlを使用したテスト例

```bash
#!/bin/bash

# 環境変数
AUTH_PROXY_URL="https://xxx.execute-api.us-east-1.amazonaws.com/prod"
MCP_SERVER_URL="https://yyy.execute-api.us-east-1.amazonaws.com/prod"
CLIENT_ID="https://example.com/client.json"
REDIRECT_URI="http://localhost:3000/callback"

# PKCEパラメータ生成
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | base64 | tr -d '=' | tr '+/' '-_')

echo "Code Verifier: $CODE_VERIFIER"
echo "Code Challenge: $CODE_CHALLENGE"

# 1. Protected Resource Metadata取得
echo -e "\n=== Step 1: Get Protected Resource Metadata ==="
curl -s "${MCP_SERVER_URL}/.well-known/oauth-protected-resource" | jq .

# 2. 認可URL生成
echo -e "\n=== Step 2: Authorization URL ==="
AUTH_URL="${AUTH_PROXY_URL}/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&state=xyz123&scope=mcp:tools&resource=${MCP_SERVER_URL}"
echo "$AUTH_URL"
echo "Open this URL in your browser to authenticate"

# 3. トークン交換（認可コード取得後）
echo -e "\n=== Step 3: Token Exchange ==="
echo "After authentication, run:"
echo "curl -X POST \"${AUTH_PROXY_URL}/token\" \\"
echo "  -H \"Content-Type: application/x-www-form-urlencoded\" \\"
echo "  -d \"grant_type=authorization_code\" \\"
echo "  -d \"code=YOUR_AUTH_CODE\" \\"
echo "  -d \"redirect_uri=${REDIRECT_URI}\" \\"
echo "  -d \"client_id=${CLIENT_ID}\" \\"
echo "  -d \"code_verifier=${CODE_VERIFIER}\""

# 4. MCPリクエスト（トークン取得後）
echo -e "\n=== Step 4: MCP Request ==="
echo "After getting the access token, run:"
echo "curl -X POST \"${MCP_SERVER_URL}/mcp\" \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"jsonrpc\": \"2.0\", \"method\": \"tools/list\", \"id\": 1}'"
```

## まとめ

このガイドでは、認証付きMCPサーバーの使用方法を詳しく説明しました。主なポイント：

1. Client ID Metadata DocumentをHTTPS URLでホスト
2. PKCEを使用した安全な認可フロー
3. アクセストークンを使用したMCPツールへのアクセス
4. 適切なエラーハンドリングとトークンリフレッシュ

詳細な仕様については、[MCP仕様書](../mcp-spec.html)を参照してください。
