.PHONY: help install build test deploy update destroy outputs clean bootstrap synth diff

help: ## このヘルプメッセージを表示
	@echo "利用可能なコマンド:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## 依存関係をインストール
	npm install

build: ## TypeScriptをビルド
	npm run build

test: ## テストを実行
	npm test

bootstrap: ## CDKブートストラップを実行
	npm run bootstrap

synth: build ## CDKスタックをシンセサイズ
	npm run synth

diff: build ## スタックの変更を表示
	npm run diff

deploy: build ## スタックをデプロイ
	./scripts/deploy.sh

update: build ## スタックを更新
	./scripts/update.sh

destroy: ## スタックを削除
	./scripts/destroy.sh

outputs: ## スタック出力を表示
	./scripts/get-outputs.sh

clean: ## ビルド成果物を削除
	rm -rf dist/
	rm -rf cdk.out/
	rm -rf node_modules/

create-user: ## テストユーザーを作成 (USER_POOL_ID, EMAIL, PASSWORD必須)
	@if [ -z "$(USER_POOL_ID)" ] || [ -z "$(EMAIL)" ] || [ -z "$(PASSWORD)" ]; then \
		echo "エラー: USER_POOL_ID, EMAIL, PASSWORDを指定してください"; \
		echo "使用例: make create-user USER_POOL_ID=us-east-1_XXX EMAIL=test@example.com PASSWORD=Test123!"; \
		exit 1; \
	fi
	./scripts/create-test-user.sh $(USER_POOL_ID) $(EMAIL) $(PASSWORD)

verify-cognito: ## Cognito設定を確認 (USER_POOL_ID必須)
	@if [ -z "$(USER_POOL_ID)" ]; then \
		echo "エラー: USER_POOL_IDを指定してください"; \
		echo "使用例: make verify-cognito USER_POOL_ID=us-east-1_XXX"; \
		exit 1; \
	fi
	./scripts/verify-cognito-setup.sh $(USER_POOL_ID)

update-callback: ## Cognitoコールバックを更新（初回デプロイ後に実行）
	./scripts/update-cognito-callback.sh

all: install build test deploy ## すべて実行（インストール、ビルド、テスト、デプロイ）
