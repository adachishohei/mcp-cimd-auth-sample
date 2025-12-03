# 同意フロー（Consent Flow）分析

## MCP仕様の要件

### Client ID Metadata Documents Flow

MCP仕様では、以下のフローが定義されています：

```
1. MCP Client → Authorization Server
   - Client ID Metadata Documentを使用した認可リクエスト

2. Authorization Server → Client ID Metadata Document
   - client_idからメタデータを取得
   - client_name, client_uri, logo_uri等を取得

3. Authorization Server → User
   - Display consent page with client_name
   - ユーザーに対してクライアント情報を表示
   - スコープの説明を表示

4. User → Authorization Server
   - Approves Access (同意)
   - または Denies Access (拒否)

5. Authorization Server → MCP Client
   - 認可コードを返す（同意の場合）
   - エラーを返す（拒否の場合）
```

### 重要な要件

#### 1. client_nameの表示
MCP仕様では、Client ID Metadata Documentに以下のフィールドが必須または推奨されています：

- **client_name** (必須): クライアントの人間が読める名前
- **client_uri** (推奨): クライアントのホームページURL
- **logo_uri** (推奨): クライアントのロゴ画像URL

これらの情報は、**同意画面でユーザーに表示される必要があります**。

#### 2. Confused Deputy Problem対策
MCP仕様のセキュリティセクションより：

> MCP proxy servers using static client IDs **MUST** obtain user consent for each dynamically
> registered client before forwarding to third-party authorization servers.

つまり、認可プロキシは：
- 各MCPクライアントに対して個別にユーザーの同意を取得する必要がある
- Client ID Metadata Documentから取得した`client_name`を表示する必要がある
- ユーザーが明示的に承認または拒否できる必要がある

## 現在の実装の分析

### 実装されているフロー

```
1. MCP Client → Auth Proxy (/authorize)
   ✅ Client ID Metadata Documentを取得
   ✅ client_id, redirect_uriを検証

2. Auth Proxy → Cognito Managed UI
   ❌ Client ID Metadata Documentの情報を渡していない
   ❌ client_nameを表示していない

3. Cognito Managed UI → User
   ❌ MCPクライアントの情報が表示されない
   ❌ Cognitoのデフォルト画面のみ

4. User → Cognito
   ⚠️ Cognitoレベルでの同意のみ（MCPクライアント固有の同意ではない）

5. Cognito → Auth Proxy (/callback)
   ✅ 認可コードを受け取る

6. Auth Proxy → MCP Client
   ✅ 認可コードを転送
```

### 問題点

#### 🔴 重大な問題: MCPクライアント固有の同意画面がない

現在の実装では：
1. Cognitoの汎用的なログイン画面のみが表示される
2. MCPクライアントの`client_name`、`client_uri`、`logo_uri`が表示されない
3. ユーザーは「どのアプリケーションがアクセスを要求しているか」を知ることができない

これは、MCP仕様の要件を満たしていません。

#### 🟡 セキュリティリスク: Confused Deputy Problem

同意画面がないため：
- 攻撃者が盗んだ認可コードを使用できる可能性
- ユーザーが意図しないクライアントにアクセスを許可する可能性
- どのクライアントがアクセスしているか追跡できない

## 必要な修正

### オプション1: カスタム同意画面の実装（推奨）

Auth Proxyに同意画面を追加：

```
1. MCP Client → Auth Proxy (/authorize)
   ✅ Client ID Metadata Documentを取得

2. Auth Proxy → User (Consent Page)
   ✅ client_nameを表示
   ✅ client_uri, logo_uriを表示
   ✅ 要求されるスコープを表示
   ✅ "Approve" / "Deny" ボタン

3. User → Auth Proxy
   ✅ 同意または拒否

4. Auth Proxy → Cognito (同意の場合のみ)
   ✅ Cognitoでの認証

5. Cognito → Auth Proxy → MCP Client
   ✅ 認可コードを返す
```

#### 実装方法

**新規エンドポイント: `/consent`**

```typescript
// src/auth-proxy/consent.ts
export async function handler(event: APIGatewayProxyEvent) {
  const sessionId = event.queryStringParameters?.session;
  
  // セッションからClient ID Metadata Documentを取得
  const session = await retrieveSession(sessionId);
  const clientMetadata = session.clientMetadata;
  
  // 同意画面のHTMLを返す
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: renderConsentPage({
      clientName: clientMetadata.client_name,
      clientUri: clientMetadata.client_uri,
      logoUri: clientMetadata.logo_uri,
      scopes: session.scope,
      sessionId,
    }),
  };
}
```

**同意処理エンドポイント: `/consent/approve` と `/consent/deny`**

```typescript
// src/auth-proxy/consent-action.ts
export async function approveHandler(event: APIGatewayProxyEvent) {
  const sessionId = event.body?.session;
  
  // セッションを更新（同意済みフラグ）
  await updateSession(sessionId, { consented: true });
  
  // Cognitoにリダイレクト
  return redirectToCognito(sessionId);
}

export async function denyHandler(event: APIGatewayProxyEvent) {
  const sessionId = event.body?.session;
  const session = await retrieveSession(sessionId);
  
  // MCPクライアントにエラーを返す
  return redirectToClient(session.redirect_uri, {
    error: 'access_denied',
    error_description: 'User denied access',
    state: session.state,
  });
}
```

**フロー修正:**

```typescript
// src/auth-proxy/authorize.ts
export async function handler(event: APIGatewayProxyEvent) {
  // ... 既存の検証 ...
  
  // Client ID Metadata Documentを取得
  const clientMetadata = await fetchClientMetadata(clientId);
  
  // セッションにメタデータを保存
  const session = {
    code_challenge,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    clientMetadata, // ← 追加
    consented: false, // ← 追加
    // ...
  };
  
  await saveSession(sessionId, session);
  
  // 同意画面にリダイレクト（Cognitoではなく）
  return {
    statusCode: 302,
    headers: {
      Location: `/consent?session=${sessionId}`,
    },
    body: '',
  };
}
```

### オプション2: Cognito Hosted UIのカスタマイズ（制限あり）

Cognito Hosted UIをカスタマイズして、クライアント情報を表示：

**制限事項:**
- Cognitoのカスタマイズは限定的
- Client ID Metadata Documentの情報を動的に表示するのは困難
- MCPクライアントごとの同意を取得するのは不可能

**結論:** この方法はMCP仕様の要件を満たせない

### オプション3: 外部IDプロバイダーの使用

Auth0、Okta等の外部IDプロバイダーを使用：

**利点:**
- 動的な同意画面のサポート
- Client ID Metadata Documentの情報を表示可能
- より柔軟なカスタマイズ

**欠点:**
- 追加のコストと複雑性
- Cognitoからの移行が必要

## 推奨実装: カスタム同意画面

### 修正後の完全なフロー

```
┌─────────────┐
│ MCP Client  │
└──────┬──────┘
       │
       │ (1) GET /authorize
       │     ?client_id=https://client.example.com/metadata.json
       │     &redirect_uri=vscode://callback
       │     &code_challenge=xxx
       ↓
┌─────────────────────┐
│  Auth Proxy         │
│  /authorize         │
└──────┬──────────────┘
       │
       │ (2) Fetch Client ID Metadata Document
       │     GET https://client.example.com/metadata.json
       │     Response: {
       │       "client_name": "VS Code MCP Client",
       │       "client_uri": "https://code.visualstudio.com",
       │       "logo_uri": "https://code.visualstudio.com/logo.png"
       │     }
       │
       │ (3) Store session with metadata
       │     DynamoDB: sessionId → {
       │       clientMetadata: {...},
       │       consented: false
       │     }
       │
       │ (4) 302 Redirect to Consent Page
       │     Location: /consent?session=sessionId
       ↓
┌─────────────────────┐
│  Auth Proxy         │
│  /consent           │
│  (Consent Page)     │
└──────┬──────────────┘
       │
       │ (5) Display Consent Page
       │     ┌────────────────────────────┐
       │     │ [Logo]                     │
       │     │ VS Code MCP Client         │
       │     │ https://code.visualstudio.com
       │     │                            │
       │     │ This application wants to: │
       │     │ • Access MCP tools         │
       │     │ • Read your profile        │
       │     │                            │
       │     │ [Approve] [Deny]           │
       │     └────────────────────────────┘
       ↓
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       │ (6) User clicks "Approve"
       │     POST /consent/approve
       │     body: { session: sessionId }
       ↓
┌─────────────────────┐
│  Auth Proxy         │
│  /consent/approve   │
└──────┬──────────────┘
       │
       │ (7) Update session
       │     DynamoDB: sessionId → { consented: true }
       │
       │ (8) 302 Redirect to Cognito
       │     Location: https://cognito.../oauth2/authorize
       ↓
┌─────────────────────┐
│  Cognito Managed UI │
└──────┬──────────────┘
       │
       │ (9) User authenticates
       │
       │ (10) 302 Redirect to Auth Proxy
       │      Location: /callback?code=xxx&state=sessionId
       ↓
┌─────────────────────┐
│  Auth Proxy         │
│  /callback          │
└──────┬──────────────┘
       │
       │ (11) Verify session.consented === true
       │      If false, return error
       │
       │ (12) 302 Redirect to MCP Client
       │      Location: vscode://callback?code=xxx
       ↓
┌─────────────┐
│ MCP Client  │
└─────────────┘
```

### セッションデータの拡張

```typescript
interface AuthSession {
  code_challenge: string;
  code_challenge_method: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  scope?: string;
  
  // 追加フィールド
  clientMetadata: ClientMetadata; // Client ID Metadata Document
  consented: boolean;              // ユーザーが同意したか
  consentedAt?: number;            // 同意した時刻
  
  created_at: number;
  ttl: number;
}
```

## セキュリティ考慮事項

### 1. CSRF保護
- 同意画面のフォームにCSRFトークンを含める
- セッションIDを検証

### 2. セッションの有効期限
- 同意画面の表示から一定時間（例: 5分）以内に同意が必要
- 期限切れの場合はエラーを返す

### 3. 同意の記録
- どのユーザーがどのクライアントに同意したかをログに記録
- 監査とセキュリティ分析のため

### 4. 同意の取り消し
- ユーザーが後から同意を取り消せる仕組み（オプション）
- `/revoke`エンドポイントの実装

## まとめ

### 現在の状態
❌ MCPクライアント固有の同意画面がない
❌ client_nameが表示されない
❌ Confused Deputy Problem対策が不十分

### 必要な実装
✅ カスタム同意画面の追加（`/consent`）
✅ Client ID Metadata Documentの情報表示
✅ ユーザーによる明示的な承認/拒否
✅ セッションへの同意状態の記録
✅ `/callback`での同意確認

### 優先度
**高**: MCP仕様への準拠とセキュリティのため、カスタム同意画面の実装は必須です。

### 次のステップ
1. 同意画面のUI設計
2. `/consent`エンドポイントの実装
3. `/consent/approve`と`/consent/deny`の実装
4. `authorize.ts`の修正（同意画面へのリダイレクト）
5. `callback.ts`の修正（同意確認の追加）
6. テストとドキュメント更新
