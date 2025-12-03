# Cognito Managed UIを使用した同意画面の実装オプション

## 質問
Cognito Managed UIを使用してMCPクライアント固有の同意画面を実装できるか？

## 回答: 部分的に可能だが、重大な制限あり

### Cognito Managed UIの機能と制限

#### ✅ Cognitoができること
1. **ユーザー認証** - ログイン画面の提供
2. **基本的なカスタマイズ** - ロゴ、CSS、色のカスタマイズ
3. **スコープの同意** - 事前定義されたスコープに対する同意画面
4. **MFA対応** - 多要素認証のサポート

#### ❌ Cognitoができないこと
1. **動的なクライアント情報の表示** - Client ID Metadata Documentから取得した`client_name`、`client_uri`、`logo_uri`を動的に表示できない
2. **クライアントごとの同意画面** - すべてのクライアントに対して同じ画面が表示される
3. **カスタムロジックの実行** - 同意前後のカスタム処理ができない
4. **詳細なUI制御** - HTMLの構造を変更できない

### Cognitoの同意画面の仕組み

Cognito Managed UIは、以下の場合に同意画面を表示します：

```
条件:
1. User Pool Clientで複数のスコープが設定されている
2. ユーザーが初めてそのクライアントにアクセスする
3. または、新しいスコープが要求される

表示内容:
- User Pool Clientの名前（固定）
- 要求されるスコープのリスト
- "Allow" / "Deny" ボタン
```

**問題点:**
- User Pool Clientは1つしか作成していない（すべてのMCPクライアントが共有）
- MCPクライアントごとの情報（client_name等）は表示されない

## 実装オプションの比較

### オプション1: カスタム同意画面（推奨）

**アーキテクチャ:**
```
MCP Client → Auth Proxy → Custom Consent Page → Cognito UI → Auth Proxy → MCP Client
                           ↑
                    MCPクライアント情報を表示
```

**利点:**
- ✅ Client ID Metadata Documentの情報を完全に表示可能
- ✅ MCPクライアントごとに異なる同意画面
- ✅ MCP仕様に完全準拠
- ✅ カスタムロジックの実行可能
- ✅ 詳細なログと監査

**欠点:**
- ❌ 追加の実装が必要
- ❌ UIの保守が必要

**実装の複雑さ:** 中程度

### オプション2: Cognito Managed UIのみ（現在の実装）

**アーキテクチャ:**
```
MCP Client → Auth Proxy → Cognito UI → Auth Proxy → MCP Client
                           ↑
                    汎用ログイン画面のみ
```

**利点:**
- ✅ 実装が簡単
- ✅ Cognitoの機能をそのまま利用

**欠点:**
- ❌ MCPクライアント情報が表示されない
- ❌ MCP仕様に非準拠
- ❌ Confused Deputy Problem対策が不十分
- ❌ ユーザーがどのアプリがアクセスしているか分からない

**実装の複雑さ:** 低

**結論:** MCP仕様の要件を満たせない

### オプション3: ハイブリッドアプローチ（実用的な妥協案）

**アーキテクチャ:**
```
MCP Client → Auth Proxy → Lightweight Consent Page → Cognito UI → Auth Proxy → MCP Client
                           ↑
                    最小限の情報表示
                    - client_name
                    - "Continue to login" ボタン
```

**実装:**
1. 軽量な同意画面を表示（HTMLのみ、認証なし）
2. ユーザーがクライアント情報を確認
3. "Continue"をクリックするとCognito UIへ
4. Cognitoで実際の認証

**利点:**
- ✅ MCPクライアント情報を表示可能
- ✅ Cognitoの認証機能を活用
- ✅ 実装が比較的簡単
- ✅ MCP仕様にほぼ準拠

**欠点:**
- ⚠️ 2段階のUI（同意画面 + ログイン画面）
- ⚠️ ユーザー体験が若干複雑

**実装の複雑さ:** 低〜中

## 推奨実装: ハイブリッドアプローチ

Cognito Managed UIを活用しつつ、MCP仕様に準拠する実用的な方法です。

### 実装詳細

#### 1. 軽量な同意画面（`/consent`）

```typescript
// src/auth-proxy/consent.ts
export async function handler(event: APIGatewayProxyEvent) {
  const sessionId = event.queryStringParameters?.session;
  const session = await retrieveSession(sessionId);
  
  if (!session) {
    return errorResponse('Invalid session');
  }
  
  // シンプルなHTML同意画面を返す
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: renderConsentPage({
      clientName: session.clientMetadata.client_name,
      clientUri: session.clientMetadata.client_uri,
      logoUri: session.clientMetadata.logo_uri,
      scopes: parseScopes(session.scope),
      sessionId,
    }),
  };
}

function renderConsentPage(data: ConsentPageData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Request</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .consent-box {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 400px;
      text-align: center;
    }
    .logo {
      width: 64px;
      height: 64px;
      margin: 0 auto 1rem;
      border-radius: 8px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem;
      color: #333;
    }
    .client-uri {
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .permissions {
      text-align: left;
      margin: 1.5rem 0;
      padding: 1rem;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .permissions h2 {
      font-size: 1rem;
      margin: 0 0 0.5rem;
      color: #333;
    }
    .permissions ul {
      margin: 0;
      padding-left: 1.5rem;
    }
    .permissions li {
      margin: 0.25rem 0;
      color: #666;
    }
    .buttons {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    button {
      flex: 1;
      padding: 0.75rem;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .approve {
      background: #0066cc;
      color: white;
    }
    .approve:hover {
      background: #0052a3;
    }
    .deny {
      background: #e0e0e0;
      color: #333;
    }
    .deny:hover {
      background: #d0d0d0;
    }
  </style>
</head>
<body>
  <div class="consent-box">
    ${data.logoUri ? `<img src="${escapeHtml(data.logoUri)}" alt="Logo" class="logo">` : ''}
    <h1>${escapeHtml(data.clientName)}</h1>
    ${data.clientUri ? `<div class="client-uri">${escapeHtml(data.clientUri)}</div>` : ''}
    
    <div class="permissions">
      <h2>This application wants to:</h2>
      <ul>
        ${data.scopes.map(scope => `<li>${escapeHtml(getScopeDescription(scope))}</li>`).join('')}
      </ul>
    </div>
    
    <p style="color: #666; font-size: 0.875rem;">
      You will be redirected to sign in after approving.
    </p>
    
    <div class="buttons">
      <form method="POST" action="/consent/deny" style="flex: 1;">
        <input type="hidden" name="session" value="${escapeHtml(data.sessionId)}">
        <button type="submit" class="deny">Deny</button>
      </form>
      <form method="POST" action="/consent/approve" style="flex: 1;">
        <input type="hidden" name="session" value="${escapeHtml(data.sessionId)}">
        <button type="submit" class="approve">Approve</button>
      </form>
    </div>
  </div>
</body>
</html>
  `;
}

function getScopeDescription(scope: string): string {
  const descriptions: Record<string, string> = {
    'openid': 'Access your basic profile',
    'email': 'Access your email address',
    'profile': 'Access your profile information',
    'mcp:tools': 'Access MCP tools and resources',
    'mcp-server/tools': 'Access MCP server tools',
  };
  return descriptions[scope] || scope;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
```

#### 2. 承認/拒否ハンドラー

```typescript
// src/auth-proxy/consent-action.ts
export async function approveHandler(event: APIGatewayProxyEvent) {
  const body = parseFormBody(event.body || '');
  const sessionId = body.session;
  
  if (!sessionId) {
    return errorResponse('Session ID required');
  }
  
  const session = await retrieveSession(sessionId);
  if (!session) {
    return errorResponse('Invalid or expired session');
  }
  
  // セッションを更新（同意済みフラグ）
  await updateSession(sessionId, {
    consented: true,
    consentedAt: Date.now(),
  });
  
  // Cognito Managed UIにリダイレクト
  const config = getAuthProxyConfig();
  const cognitoAuthUrl = buildCognitoAuthUrl(config, {
    sessionId,
    scope: session.scope,
  });
  
  return {
    statusCode: 302,
    headers: {
      Location: cognitoAuthUrl,
      'Cache-Control': 'no-store',
    },
    body: '',
  };
}

export async function denyHandler(event: APIGatewayProxyEvent) {
  const body = parseFormBody(event.body || '');
  const sessionId = body.session;
  
  if (!sessionId) {
    return errorResponse('Session ID required');
  }
  
  const session = await retrieveSession(sessionId);
  if (!session) {
    return errorResponse('Invalid or expired session');
  }
  
  // セッションを削除
  await deleteSession(sessionId);
  
  // MCPクライアントにエラーを返す
  return {
    statusCode: 302,
    headers: {
      Location: buildRedirectUrl(session.redirect_uri, {
        error: 'access_denied',
        error_description: 'User denied access',
        state: session.state,
      }),
      'Cache-Control': 'no-store',
    },
    body: '',
  };
}
```

#### 3. フロー修正

```typescript
// src/auth-proxy/authorize.ts の修正
export async function handler(event: APIGatewayProxyEvent) {
  // ... 既存の検証 ...
  
  // Client ID Metadata Documentを取得
  const clientMetadata = await fetchClientMetadata(clientId);
  
  // セッションにメタデータを保存
  const session: AuthSession = {
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state || '',
    scope,
    clientMetadata, // ← 追加
    consented: false, // ← 追加
    created_at: Date.now(),
    ttl: Math.floor(Date.now() / 1000) + 600,
  };
  
  await saveSession(sessionId, session);
  
  // 同意画面にリダイレクト
  return {
    statusCode: 302,
    headers: {
      Location: `${config.authProxyBaseUrl}/consent?session=${sessionId}`,
    },
    body: '',
  };
}
```

```typescript
// src/auth-proxy/callback.ts の修正
export async function handler(event: APIGatewayProxyEvent) {
  // ... 既存の処理 ...
  
  const session = await retrieveSession(state);
  
  if (!session) {
    throw new OAuth2Error('invalid_request', 'Invalid or expired session');
  }
  
  // 同意確認を追加
  if (!session.consented) {
    throw new OAuth2Error('access_denied', 'User consent required');
  }
  
  // MCPクライアントにリダイレクト
  return redirectToClient(session.redirect_uri, {
    code,
    state: session.state,
  });
}
```

### 完全なフロー

```
1. MCP Client → Auth Proxy (/authorize)
   ✅ Client ID Metadata Documentを取得

2. Auth Proxy → User (Consent Page)
   ✅ client_name, client_uri, logo_uriを表示
   ✅ スコープの説明を表示
   ✅ [Approve] [Deny] ボタン

3. User clicks "Approve"
   → POST /consent/approve

4. Auth Proxy → Cognito Managed UI
   ✅ ユーザー認証（ログイン）

5. Cognito → Auth Proxy (/callback)
   ✅ 認可コードを受け取る
   ✅ session.consented === true を確認

6. Auth Proxy → MCP Client
   ✅ 認可コードを転送
```

## まとめ

### 質問への回答
**Cognito Managed UIを利用できるか？**
→ **はい、ハイブリッドアプローチで可能です。**

### 推奨実装
1. **軽量な同意画面**（Auth Proxy）でMCPクライアント情報を表示
2. **Cognito Managed UI**で実際の認証を実行
3. 両方の利点を活用

### 利点
- ✅ MCP仕様に準拠
- ✅ Cognitoの認証機能を活用
- ✅ 実装が比較的簡単
- ✅ セキュリティ要件を満たす

### 次のステップ
1. 同意画面のHTMLテンプレート作成
2. `/consent`、`/consent/approve`、`/consent/deny`エンドポイントの実装
3. `authorize.ts`と`callback.ts`の修正
4. CDKスタックの更新

この実装を進めますか？
