# 循環依存エラーの修正

## 問題

CDKデプロイ時に以下のエラーが発生：

```
ValidationError: Circular dependency between resources
```

## 原因

API GatewayのURLを取得してCognito User Pool Clientの`callbackUrls`に設定しようとしたため、循環依存が発生しました。

```
Cognito User Pool Client → API Gateway URL → API Gateway → Lambda Functions → Cognito User Pool Client
                            ↑_______________________________________________|
                                        循環依存
```

## 解決策

### 1. Cognito User Pool Clientの初期設定

初回デプロイ時は、開発用のコールバックURLのみを設定：

```typescript
callbackUrls: [
  'http://localhost:3000/callback',
  'https://localhost:3000/callback',
],
```

### 2. デプロイ後の手動設定

デプロイ完了後、Auth ProxyのコールバックURLを手動で追加：

**方法1: 自動化スクリプト（推奨）**
```bash
make update-callback
# または
./scripts/update-cognito-callback.sh
```

**方法2: AWS CLI**
```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --callback-urls \
    "https://xxxxx.execute-api.region.amazonaws.com/prod/callback" \
    "http://localhost:3000/callback" \
    "https://localhost:3000/callback"
```

**方法3: AWS Console**
1. Cognito → User Pools → App clients
2. コールバックURLを追加

## 修正内容

### 修正ファイル

#### `lib/authenticated-mcp-stack.ts`
- Cognito User Pool Clientの`callbackUrls`から動的URLを削除
- CloudFormationによる動的更新コードを削除
- `CallbackEndpoint`出力は維持（手動設定用）

### 新規ファイル

#### `docs/POST_DEPLOYMENT_SETUP.md`
デプロイ後の設定手順を詳しく説明

#### `scripts/update-cognito-callback.sh`
Cognitoコールバック更新の自動化スクリプト

**機能:**
- CloudFormationスタックから必要な情報を自動取得
- Cognito User Pool Clientを自動更新
- エラーハンドリング

#### `Makefile`
`update-callback`ターゲットを追加

## デプロイ手順（更新版）

### 1. 初回デプロイ
```bash
npm run build
make deploy
```

### 2. コールバックURL更新
```bash
make update-callback
```

### 3. 動作確認
```bash
# 認可フローをテスト
curl -v "https://xxxxx.execute-api.region.amazonaws.com/prod/authorize?..."
```

## 利点

### ✅ 循環依存の解消
- CDKデプロイが正常に完了
- CloudFormationエラーなし

### ✅ 柔軟性
- API GatewayのURLが変更されても対応可能
- 手動での微調整が可能

### ✅ 自動化
- スクリプトで簡単に更新可能
- 再現性のある設定

## 代替案（検討したが採用しなかった）

### 1. Custom Resource
CloudFormation Custom Resourceを使用してデプロイ時に更新

**欠点:**
- 実装が複雑
- デバッグが困難
- Lambda関数の追加が必要

### 2. 2段階デプロイ
1回目: Cognito + API Gateway
2回目: Cognitoを更新

**欠点:**
- デプロイが2回必要
- CI/CDが複雑化

### 3. 固定URL
API Gatewayにカスタムドメインを使用

**欠点:**
- Route 53とACMの設定が必要
- コストが増加
- 初期設定が複雑

## まとめ

デプロイ後の手動設定（または自動化スクリプト実行）により、循環依存を回避しつつ、必要な機能を実現しました。

**トレードオフ:**
- ✅ シンプルな実装
- ✅ デバッグが容易
- ⚠️ 初回デプロイ後に1回だけ追加作業が必要

この方法は、開発環境とプロダクション環境の両方で実用的です。
