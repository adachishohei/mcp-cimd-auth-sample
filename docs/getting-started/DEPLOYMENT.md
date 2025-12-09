# デプロイメントガイド

このドキュメントは、Authenticated MCP Serverのデプロイ手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [初回デプロイ](#初回デプロイ)
3. [更新デプロイ](#更新デプロイ)
4. [スタックの削除](#スタックの削除)
5. [CI/CDパイプライン](#cicdパイプライン)
6. [トラブルシューティング](#トラブルシューティング)

## 前提条件

### 必要なツール

- **Node.js**: 20.x以上
- **npm**: 9.x以上
- **AWS CLI**: 2.x以上
- **AWS CDK CLI**: 2.x以上
- **esbuild**: 0.19.x以上（npm installで自動インストール）

```bash
# AWS CDK CLIのインストール
npm install -g aws-cdk

# バージョン確認
node --version
npm --version
aws --version
cdk --version
```

### AWS認証情報の設定

AWS CLIが正しく設定されていることを確認してください：

```bash
# AWS認証情報の設定
aws configure

# または環境変数を使用
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

### 必要なAWS権限

デプロイを実行するIAMユーザー/ロールには、以下のサービスへのアクセス権限が必要です：

- Amazon Cognito
- AWS Lambda
- Amazon API Gateway
- Amazon DynamoDB
- AWS CloudFormation
- AWS IAM (ロール作成用)
- AWS CloudWatch Logs

## 初回デプロイ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd authenticated-mcp-server
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定（オプション）

`.env`ファイルを作成して、必要な環境変数を設定できます：

```bash
cp .env.example .env
# .envファイルを編集
```

### 4. デプロイスクリプトの実行

```bash
./scripts/deploy.sh
```

このスクリプトは以下を実行します：

1. 依存関係のインストール
2. TypeScriptのビルド
3. CDKブートストラップ（初回のみ）
4. CDKスタックのシンセサイズ
5. CDKスタックのデプロイ

### 5. デプロイ出力の確認

デプロイが完了すると、以下の情報が出力されます：

```
Outputs:
AuthenticatedMcpStack.UserPoolId = us-east-1_XXXXXXXXX
AuthenticatedMcpStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxx
AuthenticatedMcpStack.UserPoolDomain = mcp-auth-123456789012
AuthenticatedMcpStack.CognitoManagedUIUrl = https://mcp-auth-123456789012.auth.us-east-1.amazoncognito.com
AuthenticatedMcpStack.AuthProxyApiUrl = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
AuthenticatedMcpStack.McpServerApiUrl = https://yyyyyyyyyy.execute-api.us-east-1.amazonaws.com/prod/
AuthenticatedMcpStack.AuthorizeEndpoint = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/authorize
AuthenticatedMcpStack.TokenEndpoint = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/token
AuthenticatedMcpStack.ProtectedResourceMetadataEndpoint = https://yyyyyyyyyy.execute-api.us-east-1.amazonaws.com/prod/.well-known/oauth-protected-resource
AuthenticatedMcpStack.McpEndpoint = https://yyyyyyyyyy.execute-api.us-east-1.amazonaws.com/prod/mcp
```

これらの値を保存しておいてください。

### 6. スタック出力の取得

後で出力値を確認する場合は、以下のスクリプトを使用します：

```bash
./scripts/get-outputs.sh
```

### 7. テストユーザーの作成

デプロイ後、テストユーザーを作成します：

```bash
./scripts/create-test-user.sh <USER_POOL_ID> test@example.com TestPassword123!
```

### 8. Cognito設定の確認

```bash
./scripts/verify-cognito-setup.sh <USER_POOL_ID>
```

## 更新デプロイ

コードを変更した後、スタックを更新する場合：

### 方法1: 更新スクリプトを使用

```bash
./scripts/update.sh
```

このスクリプトは：

1. TypeScriptをビルド
2. 変更を表示（`cdk diff`）
3. 確認プロンプト
4. スタックを更新

### 方法2: 手動で更新

```bash
# ビルド
npm run build

# 変更を確認
cdk diff

# デプロイ
cdk deploy
```

## スタックの削除

スタックを完全に削除する場合：

```bash
./scripts/destroy.sh
```

または手動で：

```bash
cdk destroy
```

**注意**: この操作は元に戻せません。すべてのリソース（Cognito User Pool、DynamoDBテーブルなど）が削除されます。

## CI/CDパイプライン

### GitHub Actionsの設定

このプロジェクトには、GitHub Actionsを使用したCI/CDパイプラインが含まれています。

#### 必要なシークレット

GitHubリポジトリの Settings > Secrets and variables > Actions で以下を設定：

1. **AWS_ROLE_ARN**: デプロイに使用するIAMロールのARN
   - OIDC認証を使用する場合
   - 例: `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`

2. **AWS_REGION**: デプロイ先のAWSリージョン
   - 例: `us-east-1`

#### OIDCプロバイダーの設定

GitHub ActionsからAWSにアクセスするために、OIDCプロバイダーを設定します：

1. AWS IAM Console > Identity providers > Add provider
2. Provider type: OpenID Connect
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`

次に、IAMロールを作成：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:your-org/your-repo:*"
        }
      }
    }
  ]
}
```

#### ワークフロー

- **Test Workflow** (`.github/workflows/test.yml`): 
  - プルリクエストとmainブランチへのプッシュで実行
  - テストとビルドを実行

- **Deploy Workflow** (`.github/workflows/deploy.yml`):
  - mainブランチへのプッシュで実行
  - テスト、ビルド、デプロイを実行

### 手動デプロイのトリガー

GitHub Actions UIから手動でデプロイをトリガーできます：

1. Actions タブを開く
2. "Deploy to AWS" ワークフローを選択
3. "Run workflow" をクリック

## トラブルシューティング

### CDKブートストラップエラー

**エラー**: `This stack uses assets, so the toolkit stack must be deployed to the environment`

**解決策**:
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Lambda関数のビルドエラー

**エラー**: `Cannot find module` または `dist/` ディレクトリが見つからない

**解決策**:
```bash
# TypeScriptを再ビルド
npm run build

# distディレクトリの確認
ls -la dist/
```

### Cognito User Poolの削除エラー

**エラー**: User Poolに関連付けられたリソースがあるため削除できない

**解決策**:
1. AWS Console > Cognito > User Pools
2. 該当のUser Poolを選択
3. App clients を削除
4. Domain を削除
5. User Pool を削除

### API Gatewayのデプロイエラー

**エラー**: API Gatewayのデプロイが失敗する

**解決策**:
```bash
# スタックを完全に削除して再デプロイ
cdk destroy
cdk deploy
```

### 権限エラー

**エラー**: `User: arn:aws:iam::xxx:user/xxx is not authorized to perform: xxx`

**解決策**:
- IAMユーザー/ロールに必要な権限を追加
- 管理者に権限の付与を依頼

### DynamoDBテーブルの削除エラー

**エラー**: テーブルが削除できない

**解決策**:
```bash
# 手動でテーブルを削除
aws dynamodb delete-table --table-name mcp-auth-sessions
```

## ベストプラクティス

### 本番環境へのデプロイ

1. **環境の分離**: 開発、ステージング、本番環境を分ける
   ```bash
   cdk deploy --context environment=production
   ```

2. **リソースの保護**: 本番環境では `removalPolicy` を `RETAIN` に変更
   ```typescript
   removalPolicy: cdk.RemovalPolicy.RETAIN
   ```

3. **バックアップ**: DynamoDBテーブルのポイントインタイムリカバリを有効化

4. **モニタリング**: CloudWatch Alarmsを設定

5. **セキュリティ**: 
   - Cognito User Poolのパスワードポリシーを強化
   - API Gatewayにレート制限を設定
   - Lambda関数に最小権限の原則を適用

### コスト最適化

1. **Lambda**: 適切なメモリサイズとタイムアウトを設定
2. **DynamoDB**: オンデマンドモードまたはプロビジョニングモードを選択
3. **API Gateway**: 不要なログを無効化
4. **Cognito**: 使用していないUser Poolを削除

## 参考リンク

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Amazon API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
