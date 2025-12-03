# デプロイ後の設定手順

## 概要

初回デプロイ後、Cognito User Pool ClientのコールバックURLを手動で更新する必要があります。
これは、API GatewayのURLがデプロイ時に決定されるため、循環依存を避けるための措置です。

## 手順

### 1. デプロイ実行

```bash
npm run build
make deploy
```

### 2. Auth Proxy APIのURLを取得

デプロイ完了後、以下の出力を確認：

```
Outputs:
AuthenticatedMcpStack.AuthProxyApiUrl = https://xxxxx.execute-api.region.amazonaws.com/prod/
AuthenticatedMcpStack.CallbackEndpoint = https://xxxxx.execute-api.region.amazonaws.com/prod/callback
```

`CallbackEndpoint`の値をコピーします。

### 3. Cognito User Pool Clientの更新

#### オプション1: AWS CLIを使用

```bash
# 環境変数を設定
export CALLBACK_URL="https://xxxxx.execute-api.region.amazonaws.com/prod/callback"
export USER_POOL_ID="us-east-1_XXXXXXXXX"  # デプロイ出力から取得
export CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"  # デプロイ出力から取得

# Cognito User Pool Clientを更新
aws cognito-idp update-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --callback-urls \
    "$CALLBACK_URL" \
    "http://localhost:3000/callback" \
    "https://localhost:3000/callback" \
  --allowed-o-auth-flows authorization_code \
  --allowed-o-auth-scopes openid email profile mcp-server/tools \
  --allowed-o-auth-flows-user-pool-client \
  --supported-identity-providers COGNITO
```

#### オプション2: AWS Consoleを使用

1. AWS Consoleにログイン
2. Cognito → User Pools → `mcp-authenticated-server-pool`を選択
3. "App integration"タブ → "App clients and analytics"
4. `mcp-server-client`をクリック
5. "Hosted UI settings"セクションで"Edit"をクリック
6. "Allowed callback URLs"に以下を追加：
   ```
   https://xxxxx.execute-api.region.amazonaws.com/prod/callback
   ```
7. "Save changes"をクリック

### 4. 動作確認

```bash
# 認可フローをテスト
curl -v "https://xxxxx.execute-api.region.amazonaws.com/prod/authorize?response_type=code&client_id=https://example.com/client.json&redirect_uri=http://localhost:3000/callback&code_challenge=xxx&code_challenge_method=S256"
```

同意画面にリダイレクトされることを確認します。

## 自動化スクリプト

便利なスクリプトを用意しました：

```bash
# スクリプトを実行
./scripts/update-cognito-callback.sh
```

このスクリプトは：
1. CloudFormationスタックから必要な情報を取得
2. Cognito User Pool Clientを自動更新

## トラブルシューティング

### エラー: "redirect_uri_mismatch"

**原因**: Cognitoのコールバックが更新されていない

**解決**: 上記の手順3を実行してコールバックURLを更新

### エラー: "Invalid callback URL"

**原因**: コールバックURLの形式が正しくない

**解決**: URLの末尾に`/callback`が含まれていることを確認

## 注意事項

- この設定は初回デプロイ後に**一度だけ**実行すれば十分です
- API GatewayのURLは変更されない限り、再設定は不要です
- スタックを削除して再作成した場合は、再度設定が必要です

## 次のステップ

設定完了後、以下のドキュメントを参照：
- [使用ガイド](USAGE_GUIDE.md)
- [認可フロー例](AUTHORIZATION_FLOW_EXAMPLE.md)
- [トラブルシューティング](DEPLOYMENT.md#トラブルシューティング)
