# リダイレクトフロー修正サマリー

## 修正日時
2024年12月

## 修正内容

MCP仕様のClient ID Metadata Documents方式に完全準拠するため、OAuth 2.1認可フローのリダイレクト処理を修正しました。

## 修正前の問題

### 不正なフロー
```
MCP Client → Auth Proxy → Cognito → MCP Client (直接)
                                      ↑
                                   問題: Auth Proxyを経由しない
```

**問題点:**
- Cognitoが直接MCPクライアントにリダイレクト
- MCPクライアントの動的なredirect_uriをCognitoに事前登録できない
- VS Code等のMCPクライアントと互換性がない

## 修正後の正しいフロー

### 正しいフロー
```
MCP Client → Auth Proxy → Cognito → Auth Proxy → MCP Client
             (/authorize)            (/callback)
```

**改善点:**
- Auth Proxyが中継役として機能
- Cognitoは固定のAuth Proxy callbackにのみリダイレクト
- Auth ProxyがMCPクライアントの動的なredirect_uriに転送
- MCP仕様とOAuth 2.1に完全準拠

## 実装した変更

### 1. 新規ファイル

#### `src/auth-proxy/callback.ts`
Cognitoからの認可コードを受け取り、MCPクライアントにリダイレクトするエンドポイント。

**主な機能:**
- Cognitoからの認可コード受信
- セッションからMCPクライアントのredirect_uri取得
- MCPクライアントへのリダイレクト（認可コード付き）
- エラーハンドリング

### 2. 修正ファイル

#### `src/auth-proxy/authorize.ts`
- `buildCognitoAuthUrl`関数を修正
- Cognitoへのリダイレクト時に、Auth Proxyの`/callback`エンドポイントを使用
- MCPクライアントのredirect_uriは直接使用しない

#### `src/config/index.ts`
- `AuthProxyConfig`インターフェースに`authProxyBaseUrl`を追加
- `getAuthProxyConfig`関数で`AUTH_PROXY_BASE_URL`環境変数をサポート

#### `lib/authenticated-mcp-stack.ts`
- `/callback`エンドポイント用のLambda関数を追加
- API Gatewayに`/callback`ルートを追加
- Cognito User Pool Clientの`callbackUrls`を更新（Auth Proxyのコールバックを含む）
- `AUTH_PROXY_BASE_URL`環境変数を各Lambda関数に設定

#### `openapi.yaml`
- `/callback`エンドポイントの仕様を追加

## ネットワーク通信フロー（詳細）

### 1. 認可リクエスト
```
MCP Client → Auth Proxy (/authorize)
  Request:
    GET /authorize?
      client_id=https://client.example.com/metadata.json&
      redirect_uri=vscode://callback&
      code_challenge=xxx&
      code_challenge_method=S256&
      state=client-state-123
```

### 2. Client ID Metadata Document取得・検証
```
Auth Proxy → Client's Metadata URL
  Request:
    GET https://client.example.com/metadata.json
  
  Response:
    {
      "client_id": "https://client.example.com/metadata.json",
      "redirect_uris": ["vscode://callback"],
      ...
    }
  
  Validation:
    ✓ client_id matches URL
    ✓ redirect_uri in redirect_uris
```

### 3. セッション保存
```
Auth Proxy → DynamoDB
  Store:
    sessionId: "abc123"
    code_challenge: "xxx"
    redirect_uri: "vscode://callback"
    state: "client-state-123"
    ...
```

### 4. Cognitoへリダイレクト
```
Auth Proxy → MCP Client (302 Redirect)
  Response:
    Location: https://cognito.../oauth2/authorize?
      redirect_uri=https://auth-proxy.../callback&  ← Auth Proxyのコールバック
      state=abc123&                                  ← セッションID
      ...
```

### 5. ユーザー認証
```
MCP Client → Cognito Managed UI
  User authenticates via browser
```

### 6. Cognitoからコールバック
```
Cognito → Auth Proxy (/callback)
  Request:
    GET /callback?
      code=cognito-auth-code&
      state=abc123                ← セッションID
```

### 7. セッション取得
```
Auth Proxy → DynamoDB
  Retrieve:
    sessionId: "abc123"
    → redirect_uri: "vscode://callback"
    → state: "client-state-123"
```

### 8. MCPクライアントへリダイレクト
```
Auth Proxy → MCP Client (302 Redirect)
  Response:
    Location: vscode://callback?
      code=cognito-auth-code&
      state=client-state-123      ← 元のstate値
```

### 9. トークン交換
```
MCP Client → Auth Proxy (/token)
  Request:
    POST /token
      code=cognito-auth-code&
      code_verifier=xxx&
      state=abc123
```

### 10. PKCE検証とトークン取得
```
Auth Proxy → Cognito Token Endpoint
  Request:
    POST /oauth2/token
      code=cognito-auth-code&
      ...
  
  Response:
    {
      "access_token": "...",
      "refresh_token": "...",
      ...
    }
```

### 11. トークン返却
```
Auth Proxy → MCP Client
  Response:
    {
      "access_token": "...",
      "refresh_token": "...",
      ...
    }
```

## 環境変数の追加

### Auth Proxy Lambda関数
```
AUTH_PROXY_BASE_URL: https://xxx.execute-api.region.amazonaws.com/prod
```

この環境変数は、CDKスタックによって自動的に設定されます。

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
- `AuthProxyApiUrl`: Auth ProxyのベースURL
- `CallbackEndpoint`: Cognitoコールバック用のURL
- `AuthorizeEndpoint`: 認可エンドポイント
- `TokenEndpoint`: トークンエンドポイント

## テスト

### 手動テスト
1. MCPクライアントから認可リクエストを送信
2. Cognito Managed UIでログイン
3. MCPクライアントのredirect_uriにリダイレクトされることを確認
4. 認可コードを使用してトークンを取得

### 確認ポイント
- ✅ Cognitoが`/callback`エンドポイントにリダイレクト
- ✅ `/callback`がMCPクライアントのredirect_uriにリダイレクト
- ✅ 元のstate値が保持されている
- ✅ トークン交換が成功する

## VS Code MCP Clientとの互換性

修正後、以下の点でVS Code MCP Clientと完全に互換性があります：

1. ✅ Client ID Metadata Documentsのサポート
2. ✅ 動的なredirect_uri（`vscode://`スキーム）のサポート
3. ✅ PKCE (S256)の完全サポート
4. ✅ OAuth 2.1認可コードフローの正しい実装
5. ✅ state値の適切な処理

## セキュリティ考慮事項

### 改善点
1. **CSRF保護**: state値を適切に処理
2. **セッション管理**: DynamoDBでセッションを安全に管理
3. **PKCE検証**: code_verifierとcode_challengeの検証
4. **リダイレクトURI検証**: Client ID Metadata Documentで検証

### 注意点
1. セッションのTTL（10分）を適切に設定
2. HTTPSの使用を強制
3. エラーハンドリングの徹底

## トラブルシューティング

### Cognitoのコールバックエラー
**症状**: Cognitoが「Invalid redirect_uri」エラーを返す

**原因**: Cognito User Pool Clientの`callbackUrls`にAuth Proxyの`/callback`が登録されていない

**解決**: CDKスタックを再デプロイして、Cognito設定を更新

### セッションが見つからない
**症状**: `/callback`エンドポイントで「Invalid or expired session」エラー

**原因**: セッションのTTLが切れた、またはstate値が不正

**解決**: 
- セッションのTTLを確認（デフォルト10分）
- state値が正しく渡されているか確認

## 参考資料

- [MCP Specification - Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [OAuth Client ID Metadata Document](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)

## まとめ

この修正により、認証MCPサーバーは以下を達成しました：

1. ✅ MCP仕様のClient ID Metadata Documents方式に完全準拠
2. ✅ OAuth 2.1認可コードフロー（PKCE必須）の正しい実装
3. ✅ VS Code等のMCPクライアントとの完全な互換性
4. ✅ 動的なredirect_uriのサポート
5. ✅ セキュアな認可フローの実装

これで、VS Code MCP Clientを含む任意のMCPクライアントと正しく通信できるようになりました。
