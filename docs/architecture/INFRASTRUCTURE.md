# インフラストラクチャドキュメント

このドキュメントは、Authenticated MCP Serverのインフラストラクチャ構成を説明します。

## 概要

本システムは、AWS CDKを使用してインフラストラクチャをコードとして管理しています。以下のAWSサービスを使用します：

- **Amazon Cognito**: ユーザー認証とトークン発行
- **AWS Lambda**: サーバーレス関数実行
- **Amazon API Gateway**: RESTful APIエンドポイント
- **Amazon DynamoDB**: セッションデータストレージ
- **AWS CloudWatch**: ログとモニタリング
- **AWS IAM**: アクセス制御

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                        MCPクライアント                         │
│                      (Kiro IDE等)                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ OAuth 2.1 認可フロー
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────────────┐   ┌─────────────────┐
│  認可プロキシ    │   │  MCPサーバー     │
│  API Gateway    │   │  API Gateway    │
└────────┬────────┘   └────────┬────────┘
         │                     │
    ┌────┴────┐           ┌────┴────┐
    │         │           │         │
    ▼         ▼           ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Authorize│ │ Token  │ │Metadata│ │  MCP   │
│ Lambda │ │ Lambda │ │ Lambda │ │ Lambda │
└────┬───┘ └───┬────┘ └────────┘ └───┬────┘
     │         │                      │
     │    ┌────┴────┐                 │
     │    │         │                 │
     ▼    ▼         ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  DynamoDB    │ │   Cognito    │ │  CloudWatch  │
│  Sessions    │ │  User Pool   │ │    Logs      │
└──────────────┘ └──────────────┘ └──────────────┘
```

## リソース構成

### 1. Amazon Cognito User Pool

**リソース名**: `McpUserPool`

**設定**:
- サインアップ: 有効
- サインイン方法: Email、Username
- 自動検証: Email
- パスワードポリシー:
  - 最小長: 8文字
  - 小文字、大文字、数字、記号を必須
- アカウント復旧: Emailのみ

**User Pool Domain**:
- ドメインプレフィックス: `mcp-auth-{ACCOUNT_ID}`
- Managed UI: 有効

**User Pool Client**:
- クライアントタイプ: Public（シークレットなし）
- OAuth 2.1フロー: Authorization Code Grant (PKCE必須)
- スコープ:
  - `openid`
  - `email`
  - `profile`
  - `mcp-server/tools` (カスタムスコープ)
- コールバックURL:
  - `http://localhost:3000/callback`
  - `https://localhost:3000/callback`

**Resource Server**:
- 識別子: `mcp-server`
- カスタムスコープ: `tools`

### 2. Amazon DynamoDB

**テーブル名**: `mcp-auth-sessions`

**設定**:
- パーティションキー: `sessionId` (String)
- 課金モード: オンデマンド
- TTL属性: `ttl`
- 削除ポリシー: DESTROY（開発用）

**用途**:
- OAuth 2.1認可フローのセッションデータ保存
- PKCE検証用のcode_challenge保存

### 3. AWS Lambda関数

#### 3.1 Authorize Function

**関数名**: `AuthorizeFunction`

**設定**:
- ランタイム: Node.js 20.x
- ハンドラー: `authorize.handler`
- タイムアウト: 30秒
- ログ保持期間: 7日

**環境変数**:
- `SESSION_TABLE_NAME`: DynamoDBテーブル名
- `COGNITO_DOMAIN`: Cognito User Pool Domain
- `COGNITO_CLIENT_ID`: Cognito User Pool Client ID
- `COGNITO_REGION`: AWSリージョン

**IAM権限**:
- DynamoDB: PutItem, UpdateItem（セッションテーブル）

**用途**:
- OAuth 2.1認可エンドポイント（`/authorize`）
- Client ID Metadata Document取得・検証
- Cognito Managed UIへのリダイレクト

#### 3.2 Token Function

**関数名**: `TokenFunction`

**設定**:
- ランタイム: Node.js 20.x
- ハンドラー: `token.handler`
- タイムアウト: 30秒
- ログ保持期間: 7日

**環境変数**:
- `SESSION_TABLE_NAME`: DynamoDBテーブル名
- `COGNITO_DOMAIN`: Cognito User Pool Domain
- `COGNITO_CLIENT_ID`: Cognito User Pool Client ID
- `COGNITO_REGION`: AWSリージョン

**IAM権限**:
- DynamoDB: GetItem, DeleteItem（セッションテーブル）

**用途**:
- OAuth 2.1トークンエンドポイント（`/token`）
- PKCE検証
- Cognitoトークンエンドポイント呼び出し

#### 3.3 Metadata Function

**関数名**: `MetadataFunction`

**設定**:
- ランタイム: Node.js 20.x
- ハンドラー: `metadata.handler`
- タイムアウト: 10秒
- ログ保持期間: 7日

**環境変数**:
- `MCP_SERVER_URI`: MCPサーバーURI
- `AUTH_PROXY_URI`: 認可プロキシURI
- `SUPPORTED_SCOPES`: サポートするスコープ

**用途**:
- Protected Resource Metadataエンドポイント（`/.well-known/oauth-protected-resource`）

#### 3.4 MCP Handler Function

**関数名**: `McpHandlerFunction`

**設定**:
- ランタイム: Node.js 20.x
- ハンドラー: `mcp-handler.handler`
- タイムアウト: 30秒
- ログ保持期間: 7日

**環境変数**:
- `MCP_SERVER_URI`: MCPサーバーURI
- `COGNITO_USER_POOL_ID`: Cognito User Pool ID
- `COGNITO_REGION`: AWSリージョン
- `COGNITO_CLIENT_ID`: Cognito User Pool Client ID

**用途**:
- MCPプロトコルエンドポイント（`/mcp`）
- JWT検証
- MCPツール実行

### 4. Amazon API Gateway

#### 4.1 Auth Proxy API

**API名**: `MCP Auth Proxy`

**設定**:
- タイプ: REST API
- ステージ: `prod`
- CORS: 有効（すべてのオリジン）

**エンドポイント**:
- `GET /authorize`: 認可エンドポイント（Authorize Lambda）
- `POST /token`: トークンエンドポイント（Token Lambda）

#### 4.2 MCP Server API

**API名**: `MCP Server`

**設定**:
- タイプ: REST API
- ステージ: `prod`
- CORS: 有効（すべてのオリジン）

**エンドポイント**:
- `GET /.well-known/oauth-protected-resource`: Protected Resource Metadata（Metadata Lambda）
- `POST /mcp`: MCPプロトコルエンドポイント（MCP Handler Lambda）

### 5. AWS CloudWatch

**ログ保持期間**: 7日（すべてのLambda関数）

**ロググループ**:
- `/aws/lambda/AuthenticatedMcpStack-AuthorizeFunction-*`
- `/aws/lambda/AuthenticatedMcpStack-TokenFunction-*`
- `/aws/lambda/AuthenticatedMcpStack-MetadataFunction-*`
- `/aws/lambda/AuthenticatedMcpStack-McpHandlerFunction-*`

## スタック出力

CDKスタックは以下の出力を提供します：

| 出力キー | 説明 | エクスポート名 |
|---------|------|---------------|
| UserPoolId | Cognito User Pool ID | McpUserPoolId |
| UserPoolClientId | Cognito User Pool Client ID | McpUserPoolClientId |
| UserPoolDomain | Cognito User Pool Domain | McpUserPoolDomain |
| CognitoManagedUIUrl | Cognito Managed UI URL | McpCognitoManagedUIUrl |
| AuthProxyApiUrl | 認可プロキシAPI URL | McpAuthProxyApiUrl |
| McpServerApiUrl | MCPサーバーAPI URL | McpServerApiUrl |
| AuthorizeEndpoint | 認可エンドポイント URL | McpAuthorizeEndpoint |
| TokenEndpoint | トークンエンドポイント URL | McpTokenEndpoint |
| ProtectedResourceMetadataEndpoint | Protected Resource Metadata URL | McpProtectedResourceMetadataEndpoint |
| McpEndpoint | MCPプロトコルエンドポイント URL | McpEndpoint |
| SessionTableName | DynamoDBセッションテーブル名 | McpSessionTableName |

## コスト見積もり

### 月間コスト（概算）

**前提条件**:
- リクエスト数: 10,000リクエスト/月
- アクティブユーザー数: 100ユーザー

**サービス別コスト**:

1. **Amazon Cognito**:
   - MAU（月間アクティブユーザー）: 100ユーザー
   - 最初の50,000 MAUまで無料
   - コスト: $0

2. **AWS Lambda**:
   - リクエスト数: 40,000リクエスト/月（4関数 × 10,000）
   - 実行時間: 平均500ms
   - メモリ: 128MB
   - 無料枠内
   - コスト: $0

3. **Amazon API Gateway**:
   - リクエスト数: 10,000リクエスト/月
   - 最初の100万リクエストまで: $3.50/100万リクエスト
   - コスト: $0.04

4. **Amazon DynamoDB**:
   - オンデマンドモード
   - 書き込み: 10,000リクエスト/月
   - 読み込み: 10,000リクエスト/月
   - ストレージ: 1GB未満
   - 無料枠内
   - コスト: $0

5. **AWS CloudWatch Logs**:
   - ログデータ: 1GB/月
   - 最初の5GBまで無料
   - コスト: $0

**合計月間コスト**: 約 $0.04（無料枠を考慮）

**注意**: 実際のコストは使用量によって変動します。本番環境では、より多くのリクエストとユーザーが予想されるため、コストが増加します。

## セキュリティ

### IAM権限

すべてのLambda関数は、最小権限の原則に従ってIAMロールが自動的に作成されます：

- Authorize Function: DynamoDB書き込み権限のみ
- Token Function: DynamoDB読み書き権限のみ
- Metadata Function: 権限不要
- MCP Handler Function: 権限不要（Cognito JWKSは公開エンドポイント）

### ネットワークセキュリティ

- すべてのAPI GatewayエンドポイントはHTTPSのみ
- CORSは開発用に全オリジン許可（本番環境では制限を推奨）

### データ保護

- DynamoDBテーブルはTTL属性を使用して古いセッションを自動削除
- Cognitoトークンは短命（デフォルト1時間）
- リフレッシュトークンは長命（デフォルト30日）

## モニタリングとアラート

### CloudWatch Metrics

以下のメトリクスを監視できます：

1. **Lambda関数**:
   - Invocations（呼び出し回数）
   - Errors（エラー数）
   - Duration（実行時間）
   - Throttles（スロットル数）

2. **API Gateway**:
   - Count（リクエスト数）
   - 4XXError（クライアントエラー）
   - 5XXError（サーバーエラー）
   - Latency（レイテンシ）

3. **DynamoDB**:
   - ConsumedReadCapacityUnits（読み込み容量）
   - ConsumedWriteCapacityUnits（書き込み容量）
   - UserErrors（ユーザーエラー）

### 推奨アラート

本番環境では、以下のアラートを設定することを推奨します：

1. Lambda関数のエラー率が5%を超えた場合
2. API Gatewayの5XXエラーが発生した場合
3. Lambda関数の実行時間が閾値を超えた場合
4. DynamoDBのスロットルが発生した場合

## スケーラビリティ

### 自動スケーリング

- **Lambda**: 自動的にスケール（同時実行数の制限あり）
- **API Gateway**: 自動的にスケール
- **DynamoDB**: オンデマンドモードで自動スケール
- **Cognito**: 自動的にスケール

### 制限事項

- Lambda同時実行数: デフォルト1,000（リージョンごと）
- API Gatewayスロットル: デフォルト10,000リクエスト/秒
- DynamoDB: オンデマンドモードで制限なし

大規模な本番環境では、これらの制限を引き上げる必要がある場合があります。

## バックアップと復旧

### DynamoDB

- ポイントインタイムリカバリ（PITR）を有効化することを推奨
- オンデマンドバックアップを定期的に作成

### Cognito

- User Poolのエクスポート機能を使用してユーザーデータをバックアップ
- CloudFormationテンプレートでインフラストラクチャを管理

## 本番環境への移行

開発環境から本番環境に移行する際の推奨事項：

1. **削除ポリシーの変更**:
   ```typescript
   removalPolicy: cdk.RemovalPolicy.RETAIN
   ```

2. **ログ保持期間の延長**:
   ```typescript
   logRetention: logs.RetentionDays.ONE_MONTH
   ```

3. **DynamoDBのバックアップ有効化**:
   ```typescript
   pointInTimeRecovery: true
   ```

4. **CORSの制限**:
   ```typescript
   allowOrigins: ['https://your-domain.com']
   ```

5. **カスタムドメインの設定**:
   - API Gatewayにカスタムドメインを設定
   - Cognitoにカスタムドメインを設定

6. **モニタリングとアラートの設定**:
   - CloudWatch Alarmsを設定
   - SNSトピックで通知を受信

7. **環境変数の管理**:
   - AWS Systems Manager Parameter Storeを使用
   - AWS Secrets Managerで機密情報を管理

## トラブルシューティング

### よくある問題

1. **Lambda関数がタイムアウトする**:
   - タイムアウト値を増やす
   - 関数のパフォーマンスを最適化

2. **DynamoDBのスロットル**:
   - オンデマンドモードを使用
   - プロビジョニングモードの場合は容量を増やす

3. **API Gatewayの5XXエラー**:
   - Lambda関数のログを確認
   - IAM権限を確認

4. **Cognitoの認証エラー**:
   - User Pool設定を確認
   - コールバックURLが正しいか確認

## 参考リンク

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Amazon Cognito Best Practices](https://docs.aws.amazon.com/cognito/latest/developerguide/best-practices.html)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Amazon API Gateway Best Practices](https://docs.aws.amazon.com/apigateway/latest/developerguide/best-practices.html)
- [Amazon DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
