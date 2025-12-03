# 同意画面実装サマリー

## 実装日時
2024年12月

## 実装内容

MCP仕様に準拠した同意画面（Consent Page）をハイブリッドアプローチで実装しました。

## アーキテクチャ

### ハイブリッドアプローチ
```
MCP Client → Auth Proxy → Consent Page → Cognito UI → Auth Proxy → MCP Client
             (/authorize)  (/consent)     (Login)      (/callback)
```

**利点:**
- ✅ MCP仕様に準拠（client_name表示）
- ✅ Cognitoの認証機能を活用
- ✅ セキュリティ要件を満たす
- ✅ 実装が比較的シンプル

## 実装したファイル

### 1. 新規ファイル

#### `src/auth-proxy/consent.ts`
同意画面を表示するエンドポイント。

**機能:**
- セッションからClient ID Metadata Documentを取得
- client_name、client_uri、logo_uriを表示
- 要求されるスコープを表示
- [Approve] / [Deny] ボタンを提供

**デザイン:**
- レスポンシブデザイン
- モダンなUI（グラデーション背景、シャドウ）
- XSS対策（HTMLエスケープ）
- アクセシビリティ対応

#### `src/auth-proxy/consent-action.ts`
承認/拒否を処理するエンドポイント。

**機能:**
- `approveHandler`: セッションに同意フラグを設定し、Cognitoにリダイレクト
- `denyHandler`: セッションを削除し、MCPクライアントにエラーを返す

### 2. 修正ファイル

#### `src/types/index.ts`
```typescript
export interface AuthSession {
  // ... 既存フィールド
  scope?: string;
  clientMetadata: ClientMetadata;  // 追加
  consented: boolean;               // 追加
  consentedAt?: number;             // 追加
}
```

#### `src/auth-proxy/authorize.ts`
- セッションに`clientMetadata`と`consented: false`を保存
- Cognitoではなく`/consent`にリダイレクト
- 不要な`buildCognitoAuthUrl`関数を削除

#### `src/auth-proxy/callback.ts`
- `session.consented`の確認を追加
- 同意していない場合は`access_denied`エラーを返す

#### `lib/authenticated-mcp-stack.ts`
- `/consent`エンドポイント用のLambda関数を追加
- `/consent/approve`エンドポイント用のLambda関数を追加
- `/consent/deny`エンドポイント用のLambda関数を追加
- 各Lambda関数にDynamoDB権限を付与
- `ConsentEndpoint`出力を追加

## 完全なフロー

### 1. 認可リクエスト
```
MCP Client → Auth Proxy (/authorize)
  Request:
    GET /authorize?
      client_id=https://client.example.com/metadata.json&
      redirect_uri=vscode://callback&
      code_challenge=xxx&
      code_challenge_method=S256&
      state=client-state-123&
      scope=mcp:tools
```

### 2. Client ID Metadata Document取得
```
Auth Proxy → Client's Metadata URL
  Request:
    GET https://client.example.com/metadata.json
  
  Response:
    {
      "client_id": "https://client.example.com/metadata.json",
      "client_name": "VS Code MCP Client",
      "client_uri": "https://code.visualstudio.com",
      "logo_uri": "https://code.visualstudio.com/logo.png",
      "redirect_uris": ["vscode://callback"]
    }
```

### 3. セッション保存
```
Auth Proxy → DynamoDB
  Store:
    sessionId: "abc123"
    clientMetadata: { client_name: "VS Code MCP Client", ... }
    consented: false
    redirect_uri: "vscode://callback"
    state: "client-state-123"
    ...
```

### 4. 同意画面へリダイレクト
```
Auth Proxy → MCP Client (302 Redirect)
  Response:
    Location: /consent?session=abc123
```

### 5. 同意画面表示
```
User's Browser → Auth Proxy (/consent)
  
  Displays:
    ┌────────────────────────────────┐
    │ [Logo]                         │
    │ VS Code MCP Client             │
    │ https://code.visualstudio.com  │
    │                                │
    │ This application wants to:     │
    │ ✓ Access MCP tools             │
    │ ✓ Access your email            │
    │ ✓ Access your profile          │
    │                                │
    │ [Deny]  [Approve]              │
    └────────────────────────────────┘
```

### 6. ユーザーが承認
```
User → Auth Proxy (/consent/approve)
  Request:
    POST /consent/approve
    body: session=abc123
```

### 7. セッション更新
```
Auth Proxy → DynamoDB
  Update:
    sessionId: "abc123"
    consented: true
    consentedAt: 1234567890
```

### 8. Cognitoへリダイレクト
```
Auth Proxy → User's Browser (302 Redirect)
  Response:
    Location: https://cognito.../oauth2/authorize?
      redirect_uri=https://auth-proxy.../callback&
      state=abc123&
      ...
```

### 9. Cognito認証
```
User → Cognito Managed UI
  User logs in with credentials
```

### 10. Cognitoからコールバック
```
Cognito → Auth Proxy (/callback)
  Request:
    GET /callback?
      code=cognito-auth-code&
      state=abc123
```

### 11. 同意確認
```
Auth Proxy → DynamoDB
  Retrieve:
    sessionId: "abc123"
    consented: true ✓
    redirect_uri: "vscode://callback"
    state: "client-state-123"
```

### 12. MCPクライアントへリダイレクト
```
Auth Proxy → User's Browser (302 Redirect)
  Response:
    Location: vscode://callback?
      code=cognito-auth-code&
      state=client-state-123
```

### 13. トークン交換
```
MCP Client → Auth Proxy (/token)
  Request:
    POST /token
      code=cognito-auth-code&
      code_verifier=xxx&
      ...
  
  Response:
    {
      "access_token": "...",
      "refresh_token": "...",
      ...
    }
```

## セキュリティ機能

### 1. XSS対策
- すべてのユーザー入力をHTMLエスケープ
- `escapeHtml`関数で特殊文字を変換

### 2. CSRF対策
- セッションIDをフォームの隠しフィールドに含める
- セッションの一回限りの使用を強制

### 3. 同意の強制
- `/callback`で`session.consented`を確認
- 同意していない場合はエラーを返す

### 4. セッションの有効期限
- TTL: 10分
- DynamoDBで自動削除

### 5. 同意の記録
- `consentedAt`タイムスタンプを記録
- 監査とログのため

## UI/UX

### デザイン特徴
- **モダンなデザイン**: グラデーション背景、シャドウ効果
- **レスポンシブ**: モバイルデバイス対応
- **アクセシビリティ**: セマンティックHTML、適切なコントラスト
- **ユーザーフレンドリー**: 明確な説明文、視覚的なフィードバック

### 表示情報
1. **クライアントロゴ** (logo_uri)
2. **クライアント名** (client_name)
3. **クライアントURL** (client_uri)
4. **要求されるスコープ** (人間が読める説明付き)
5. **セキュリティノート** (認証情報は共有されない旨)

## デプロイ手順

### 1. ビルド
```bash
npm run build
```

### 2. デプロイ
```bash
make deploy
# または
cdk deploy
```

### 3. 確認
デプロイ後、以下の出力を確認：
- `ConsentEndpoint`: 同意画面のURL
- `AuthorizeEndpoint`: 認可エンドポイント
- `CallbackEndpoint`: Cognitoコールバック用のURL
- `TokenEndpoint`: トークンエンドポイント

## テスト

### 手動テスト手順

1. **認可リクエスト送信**
   ```
   GET /authorize?
     client_id=https://example.com/client.json&
     redirect_uri=http://localhost:3000/callback&
     code_challenge=xxx&
     code_challenge_method=S256&
     state=test-state
   ```

2. **同意画面の確認**
   - client_nameが表示されることを確認
   - client_uriが表示されることを確認
   - logo_uriが表示されることを確認（存在する場合）
   - スコープが表示されることを確認

3. **承認ボタンをクリック**
   - Cognito Managed UIにリダイレクトされることを確認

4. **Cognitoでログイン**
   - ユーザー名とパスワードを入力

5. **リダイレクト確認**
   - MCPクライアントのredirect_uriにリダイレクトされることを確認
   - 認可コードが含まれることを確認

6. **拒否ボタンのテスト**
   - 同意画面で"Deny"をクリック
   - MCPクライアントにエラーが返されることを確認
   - `error=access_denied`が含まれることを確認

### 確認ポイント
- ✅ 同意画面が表示される
- ✅ Client ID Metadata Documentの情報が正しく表示される
- ✅ 承認後、Cognitoにリダイレクトされる
- ✅ Cognito認証後、MCPクライアントにリダイレクトされる
- ✅ 拒否時、適切なエラーが返される
- ✅ 同意なしでは認可コードが発行されない

## MCP仕様への準拠

### ✅ 実装済み要件

1. **Client ID Metadata Documentsのサポート**
   - client_idからメタデータを取得
   - client_name、client_uri、logo_uriを表示

2. **同意画面の表示**
   - ユーザーに対してクライアント情報を表示
   - 要求されるスコープを説明
   - 明示的な承認/拒否ボタン

3. **Confused Deputy Problem対策**
   - 各MCPクライアントに対して個別に同意を取得
   - 同意の記録と検証

4. **OAuth 2.1準拠**
   - PKCE必須
   - 認可コードフロー
   - 適切なエラーハンドリング

## トラブルシューティング

### 同意画面が表示されない
**原因**: AUTH_PROXY_BASE_URL環境変数が設定されていない

**解決**: CDKスタックで自動設定されるため、再デプロイ

### client_nameが表示されない
**原因**: Client ID Metadata Documentにclient_nameが含まれていない

**解決**: メタデータドキュメントにclient_nameを追加

### 同意後にエラーが発生
**原因**: セッションの有効期限切れ

**解決**: TTLを延長するか、ユーザーに再試行を促す

## まとめ

ハイブリッドアプローチにより、以下を達成しました：

1. ✅ MCP仕様に完全準拠
2. ✅ Cognito Managed UIの活用
3. ✅ セキュリティ要件の充足
4. ✅ 優れたユーザー体験
5. ✅ 実装の簡潔性

これで、VS Code MCP Clientを含む任意のMCPクライアントと、MCP仕様に準拠した方法で安全に通信できるようになりました。
