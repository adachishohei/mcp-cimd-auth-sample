# タスク2実装サマリー: Amazon Cognito User Poolの設定

## 実装内容

### 1. Cognito User Poolの作成

**ファイル**: `lib/authenticated-mcp-stack.ts`

```typescript
this.userPool = new cognito.UserPool(this, 'McpUserPool', {
  userPoolName: 'mcp-authenticated-server-pool',
  selfSignUpEnabled: true,
  signInAliases: { email: true, username: true },
  autoVerify: { email: true },
  // ... その他の設定
});
```

**要件3.1を満たす**: Amazon Cognito User Poolはユーザー認証を提供

### 2. Managed UIの有効化

```typescript
this.userPoolDomain = this.userPool.addDomain('McpUserPoolDomain', {
  cognitoDomain: {
    domainPrefix: `mcp-auth-${cdk.Aws.ACCOUNT_ID}`,
  },
});
```

**要件3.2を満たす**: Cognito Managed UIはログイン画面を表示

### 3. OAuth 2.1設定（PKCE必須）

```typescript
this.userPoolClient = this.userPool.addClient('McpUserPoolClient', {
  generateSecret: false, // Public client (PKCE required)
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
      implicitCodeGrant: false,
      clientCredentials: false,
    },
    scopes: [
      cognito.OAuthScope.OPENID,
      cognito.OAuthScope.EMAIL,
      cognito.OAuthScope.PROFILE,
      cognito.OAuthScope.custom('mcp:tools'),
    ],
    callbackUrls: ['http://localhost:3000/callback', ...],
  },
});
```

**要件3.3を満たす**: 認証成功時にredirect_uriに認可コードを返却
**要件3.4を満たす**: JWT形式のアクセストークンとリフレッシュトークンを発行

### 4. カスタムスコープの設定

```typescript
const resourceServer = this.userPool.addResourceServer('McpResourceServer', {
  identifier: 'mcp-server',
  scopes: [
    {
      scopeName: 'tools',
      scopeDescription: 'Access to MCP tools',
    },
  ],
});
```

MCPツールへのアクセスを制御するカスタムスコープ `mcp-server/tools` を定義

### 5. テストユーザー作成スクリプト

**ファイル**: `scripts/create-test-user.sh`

AWS CLIを使用してテストユーザーを作成するスクリプトを提供：

```bash
./scripts/create-test-user.sh <USER_POOL_ID> <EMAIL> <PASSWORD>
```

### 6. 検証スクリプト

**ファイル**: `scripts/verify-cognito-setup.sh`

Cognito設定を検証するスクリプトを提供

### 7. ドキュメント

- **README.md**: デプロイとテストユーザー作成手順を追加
- **docs/COGNITO_SETUP.md**: 詳細なセットアップガイドを作成

## 要件との対応

| 要件 | 実装内容 | ステータス |
|------|---------|-----------|
| 3.1 | User Poolでユーザー認証を提供 | ✅ 完了 |
| 3.2 | Managed UIでログイン画面を表示 | ✅ 完了 |
| 3.3 | 認証成功時に認可コードを返却 | ✅ 完了 |
| 3.4 | JWT形式のトークンを発行 | ✅ 完了 |

## デプロイ後の確認事項

1. **CDKスタックのデプロイ**
   ```bash
   npm run deploy
   ```

2. **出力値の確認**
   - UserPoolId
   - UserPoolClientId
   - UserPoolDomain
   - CognitoManagedUIUrl

3. **テストユーザーの作成**
   ```bash
   ./scripts/create-test-user.sh <USER_POOL_ID> test@example.com TestPassword123!
   ```

4. **設定の検証**
   ```bash
   ./scripts/verify-cognito-setup.sh <USER_POOL_ID>
   ```

## 次のステップ

タスク3: 認可プロキシ - 認可エンドポイントの実装

- `/authorize` エンドポイントの実装
- Client ID Metadata Document取得機能
- client_id検証ロジック
- redirect_uri検証ロジック
- セッション管理（DynamoDB）
- Cognito Managed UIへのリダイレクト
