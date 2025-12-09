# Amazon Cognito User Pool セットアップガイド

このドキュメントでは、MCP認証サーバーのAmazon Cognito User Pool設定について説明します。

## 概要

本システムは、OAuth 2.1認可コードフロー（PKCE必須）を使用してユーザー認証を行います。Amazon Cognitoは以下の役割を果たします：

- ユーザー認証（Managed UI経由）
- アクセストークンとリフレッシュトークンの発行
- JWT署名とJWKS公開

## デプロイされる構成

### User Pool設定

- **サインイン方式**: Email または Username
- **自動検証**: Email
- **パスワードポリシー**:
  - 最小長: 8文字
  - 小文字、大文字、数字、記号を各1文字以上含む
- **アカウント復旧**: Emailのみ

### OAuth 2.1設定

- **認可フロー**: Authorization Code Grant（PKCE必須）
- **クライアントタイプ**: Public Client（シークレットなし）
- **サポートされるスコープ**:
  - `openid`: OpenID Connect標準スコープ
  - `email`: ユーザーのメールアドレスへのアクセス
  - `profile`: ユーザープロファイル情報へのアクセス
  - `mcp-server/tools`: MCPツールへのアクセス（カスタムスコープ）

### Managed UI

- **ドメインプレフィックス**: `mcp-auth-{AWS_ACCOUNT_ID}`
- **完全なURL**: `https://mcp-auth-{AWS_ACCOUNT_ID}.auth.{REGION}.amazoncognito.com`
- **コールバックURL**:
  - `http://localhost:3000/callback`
  - `https://localhost:3000/callback`
- **ログアウトURL**:
  - `http://localhost:3000`
  - `https://localhost:3000`

## デプロイ手順

### 1. CDKスタックのデプロイ

```bash
npm run deploy
```

デプロイが完了すると、以下の出力が表示されます：

```
Outputs:
AuthenticatedMcpStack.UserPoolId = us-east-1_XXXXXXXXX
AuthenticatedMcpStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxx
AuthenticatedMcpStack.UserPoolDomain = mcp-auth-123456789012
AuthenticatedMcpStack.CognitoManagedUIUrl = https://mcp-auth-123456789012.auth.us-east-1.amazoncognito.com
```

これらの値を記録しておいてください。

### 2. テストユーザーの作成

#### オプションA: スクリプトを使用

```bash
./scripts/create-test-user.sh <USER_POOL_ID> test@example.com TestPassword123!
```

#### オプションB: AWS CLIを使用

```bash
# ユーザーを作成
aws cognito-idp admin-create-user \
    --user-pool-id <USER_POOL_ID> \
    --username test@example.com \
    --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \
    --message-action SUPPRESS

# パスワードを設定
aws cognito-idp admin-set-user-password \
    --user-pool-id <USER_POOL_ID> \
    --username test@example.com \
    --password TestPassword123! \
    --permanent
```

### 3. 設定の検証

```bash
./scripts/verify-cognito-setup.sh <USER_POOL_ID>
```

## 認証フローのテスト

### 1. Managed UIへのアクセス

ブラウザで以下のURLにアクセスします：

```
https://<COGNITO_DOMAIN>.auth.<REGION>.amazoncognito.com/oauth2/authorize?
  response_type=code&
  client_id=<CLIENT_ID>&
  redirect_uri=http://localhost:3000/callback&
  scope=openid+email+profile+mcp-server/tools&
  code_challenge=<CODE_CHALLENGE>&
  code_challenge_method=S256
```

### 2. ログイン

作成したテストユーザーの認証情報でログインします。

### 3. 認可コードの取得

ログイン成功後、コールバックURLにリダイレクトされ、認可コードが含まれます：

```
http://localhost:3000/callback?code=<AUTHORIZATION_CODE>
```

### 4. トークンの取得

認可コードを使用してトークンを取得します：

```bash
curl -X POST https://<COGNITO_DOMAIN>.auth.<REGION>.amazoncognito.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id=<CLIENT_ID>" \
  -d "code=<AUTHORIZATION_CODE>" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "code_verifier=<CODE_VERIFIER>"
```

レスポンス：

```json
{
  "access_token": "eyJhbGc...",
  "id_token": "eyJhbGc...",
  "refresh_token": "eyJjdH...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

## トラブルシューティング

### ドメインが既に使用されている

エラー: `Domain already exists`

**解決策**: CDKスタックの`userPoolDomain`のドメインプレフィックスを変更してください。

### ユーザー作成時のエラー

エラー: `User already exists`

**解決策**: 既存のユーザーを削除するか、別のメールアドレスを使用してください。

```bash
aws cognito-idp admin-delete-user \
    --user-pool-id <USER_POOL_ID> \
    --username test@example.com
```

### カスタムスコープが見つからない

エラー: `Scope does not exist`

**解決策**: Resource Serverが正しく作成されていることを確認してください。CDKスタックを再デプロイしてください。

## セキュリティ考慮事項

### 本番環境での推奨事項

1. **MFA（多要素認証）の有効化**
   ```typescript
   mfaConfiguration: cognito.Mfa.REQUIRED,
   ```

2. **高度な脅威保護の有効化**
   ```typescript
   advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
   ```

3. **パスワードポリシーの強化**
   ```typescript
   passwordPolicy: {
     minLength: 12,
     requireLowercase: true,
     requireUppercase: true,
     requireDigits: true,
     requireSymbols: true,
     tempPasswordValidity: cdk.Duration.days(3),
   },
   ```

4. **削除保護の有効化**
   ```typescript
   removalPolicy: cdk.RemovalPolicy.RETAIN,
   deletionProtection: true,
   ```

5. **カスタムドメインの使用**
   - Cognitoのデフォルトドメインではなく、独自ドメインを使用

6. **ログとモニタリング**
   - CloudWatch Logsでユーザーアクティビティを監視
   - 異常なログイン試行を検出

## 参考資料

- [Amazon Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [OAuth 2.1 Authorization Framework](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [MCP Authentication Specification](https://spec.modelcontextprotocol.io/specification/2024-11-05/authentication/)
