# 要件ドキュメント

## はじめに

本ドキュメントは、MCP仕様のClient ID Metadata Documents方式を使用した認証機能を実装するリモートModel Context Protocol（MCP）サーバーの要件を定義します。本システムは、OAuth 2.1認可コードフロー（PKCE必須）を使用し、API Gateway + LambdaでClient ID Metadata Documentsを処理し、Amazon Cognitoでユーザー認証とトークン発行を行い、MCPツールとリソースへの安全なアクセスを提供します。

## 用語集

- **MCPサーバー**: MCPクライアントにツールとリソースを提供するリモートModel Context Protocolサーバー
- **MCPクライアント**: MCPサーバーに接続してツールとリソースにアクセスするアプリケーション（例：Kiro IDE）
- **Client ID Metadata Document**: MCPクライアントがホストするJSONドキュメントで、クライアントのOAuth 2.1設定情報を含む。認可プロキシがクライアントを検証するために使用する
- **認可プロキシ**: API Gateway + Lambdaで実装され、Client ID Metadata Documentsを処理し、OAuth 2.1認可フローを管理するコンポーネント
- **Amazon Cognito**: ユーザー認証を提供し、アクセストークンとリフレッシュトークンを発行するAWSサービス
- **Cognito Managed UI**: Amazon Cognitoが提供するホスト型ログイン画面
- **OAuth 2.1**: OAuth 2.0のセキュリティ強化版で、PKCE（Proof Key for Code Exchange）を必須とする認可プロトコル
- **PKCE**: 認可コードフローのセキュリティを強化する仕組みで、code_verifierとcode_challengeを使用する
- **認可コードフロー**: クライアントが認可コードを取得し、それをアクセストークンと交換するOAuth 2.1フロー
- **アクセストークン**: 保護されたMCPリソースへのアクセスに使用される認証情報（JWT形式）
- **リフレッシュトークン**: 再認証なしで新しいアクセストークンを取得するために使用される認証情報
- **Protected Resource Metadata**: MCPサーバーが公開する、認可サーバー情報を含むメタデータ

## 要件

### 要件1

**ユーザーストーリー:** システム管理者として、認可プロキシ（API Gateway + Lambda）を実装したい。そうすることで、Client ID Metadata Documentsを処理し、OAuth 2.1認可フローを管理できる。

#### 受け入れ基準

1. THE 認可プロキシは認可エンドポイント（`/authorize`）を公開しなければならない
2. WHEN MCPクライアントが認可リクエストを送信する THEN 認可プロキシはclient_id（URL形式）からClient ID Metadata Documentを取得しなければならない
3. WHEN Client ID Metadata Documentを取得する THEN 認可プロキシはドキュメント内のclient_idがURLと完全に一致することを検証しなければならない
4. WHEN 認可リクエストのredirect_uriを受け取る THEN 認可プロキシはそれがClient ID Metadata Document内のredirect_urisに含まれることを検証しなければならない
5. WHEN 検証が成功する THEN 認可プロキシはCognito Managed UIにリダイレクトしなければならない

### 要件2

**ユーザーストーリー:** システム管理者として、トークンエンドポイントを実装したい。そうすることで、PKCEを検証し、Cognitoからアクセストークンを取得できる。

#### 受け入れ基準

1. THE 認可プロキシはトークンエンドポイント（`/token`）を公開しなければならない
2. WHEN MCPクライアントがトークンリクエストを送信する THEN 認可プロキシはcode_verifierを使用してPKCEを検証しなければならない
3. WHEN PKCE検証が成功する THEN 認可プロキシはCognitoのトークンエンドポイントを呼び出してアクセストークンを取得しなければならない
4. WHEN Cognitoからトークンを取得する THEN 認可プロキシはそれをMCPクライアントに返さなければならない
5. WHEN PKCE検証が失敗する THEN 認可プロキシはエラーレスポンスを返さなければならない

### 要件3

**ユーザーストーリー:** システム管理者として、Amazon Cognitoを設定したい。そうすることで、ユーザー認証とトークン発行を行える。

#### 受け入れ基準

1. THE Amazon Cognito User Poolはユーザー認証を提供しなければならない
2. THE Cognito Managed UIはログイン画面を表示しなければならない
3. WHEN ユーザーが認証に成功する THEN CognitoはMCPクライアントのredirect_uriに認可コードを返さなければならない
4. THE CognitoはJWT形式のアクセストークンとリフレッシュトークンを発行しなければならない

### 要件4

**ユーザーストーリー:** MCPサーバー管理者として、Protected Resource Metadataを公開したい。そうすることで、MCPクライアントが認可サーバーの情報を検出できる。

#### 受け入れ基準

1. THE MCPサーバーは`/.well-known/oauth-protected-resource`エンドポイントでProtected Resource Metadataを公開しなければならない
2. THE Protected Resource Metadataはauthorization_serversフィールドを含み、認可プロキシのIssuer URLを指定しなければならない
3. THE Protected Resource Metadataはresourceフィールドを含み、MCPサーバーの正規URIを指定しなければならない
4. THE Protected Resource Metadataはscopes_supportedフィールドを含み、サポートするスコープを列挙しなければならない

### 要件5

**ユーザーストーリー:** MCPサーバーとして、受信リクエストのアクセストークンを検証したい。そうすることで、認証されたクライアントのみが保護されたリソースにアクセスできる。

#### 受け入れ基準

1. WHEN MCPクライアントがAuthorizationヘッダーなしでリクエストを送信する THEN MCPサーバーはHTTP 401レスポンスとWWW-Authenticateヘッダーを返さなければならない
2. THE WWW-Authenticateヘッダーはrealmパラメータを含み、Protected Resource MetadataのURLを指定しなければならない
3. WHEN MCPクライアントがAuthorizationヘッダー（Bearer トークン）付きでリクエストを送信する THEN MCPサーバーはAmazon CognitoのJWKSを使用してJWTトークンを検証しなければならない
4. WHEN アクセストークンが有効である THEN MCPサーバーはMCPリクエストを処理しなければならない
5. WHEN アクセストークンが無効または期限切れである THEN MCPサーバーはHTTP 401レスポンスとWWW-Authenticateヘッダー（error=invalid_token）を返さなければならない

### 要件6

**ユーザーストーリー:** MCPサーバー管理者として、サンプルMCPツールを提供したい。そうすることで、クライアントが認証済み接続をテストできる。

#### 受け入れ基準

1. THE MCPサーバーはMCPプロトコルを通じて少なくとも1つのサンプルツールを公開しなければならない
2. WHEN 認証済みクライアントがtools/listリクエストを送信する THEN MCPサーバーはツール定義を返さなければならない
3. WHEN 認証済みクライアントがtools/callリクエストを送信する THEN MCPサーバーはツールを実行して結果を返さなければならない
4. WHEN 未認証クライアントがMCPリクエストを送信する THEN MCPサーバーはHTTP 401レスポンスを返さなければならない


