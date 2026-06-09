# AIMORPHO - AIアバター連動型ボディジャーニーアプリ

AI分身アバターと共に、あなただけの体型変化ジャーニーを歩むアプリ。

## コンセプト

「痩せたい・太りたい・筋肉をつけたい」すべてのボディゴールに対応:

- **アバター同期変化** — ゴール5段階でBefore→Afterを視覚化。アバターはあなたの分身として目標に向けて変化する
- **全方向ボディケア** — 減量・増量・体型維持の3モードに対応したAIアドバイス
- **AIパーソナライズ提案** — Gemini APIによる食事解析・ゴールモード別毎日アドバイス
- **ゲーミフィケーション** — ストリーク・バッジ・グループ機能

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| モバイル | React Native (iOS / Android) |
| API | AWS API Gateway (REST) + Lambda Authorizer |
| 関数実行 | AWS Lambda (7関数 + Authorizer) |
| DB | DynamoDB シングルテーブル設計 |
| 画像保存 | S3 + Presigned URL |
| 認証 | 自前JWT (HS256) |
| AI | Gemini API (食事解析・アバター生成・アドバイス) |
| IaC | Terraform |
| CI/CD | GitHub Actions |

## リポジトリ構造

```
AIMORPHO/
├── .github/workflows/       # CI/CDパイプライン
├── backend/
│   ├── layers/              # Lambda共通Layer
│   │   ├── layer-db/        # DynamoDBクライアント・QueryHelper
│   │   ├── layer-auth/      # JWT検証・bcrypt
│   │   └── layer-gemini/    # Gemini APIクライアント
│   └── functions/           # Lambda関数
│       ├── fn-auth/         # 認証 (register/login/refresh/logout)
│       ├── fn-user/         # ユーザー・プロフィール・目標
│       ├── fn-log/          # 体重・運動記録
│       ├── fn-meal/         # 食事記録・Gemini解析
│       ├── fn-ai/           # AIアドバイス・ジャーニーチェック
│       ├── fn-avatar/       # アバター生成 (timeout 90s)
│       └── fn-social/       # グループ・バッジ
├── infrastructure/          # Terraform
│   └── modules/
│       ├── dynamodb/        # DynamoDB + GSI
│       ├── lambda/          # Lambda関数・Layer・Provisioned Concurrency
│       ├── api_gateway/     # REST API + Lambda Authorizer
│       ├── s3/              # 画像バケット + ライフサイクル
│       ├── iam/             # 実行ロール・ポリシー
│       └── secrets/         # AWS Secrets Manager
├── mobile/                  # React Nativeアプリ
└── docs/                    # 設計ドキュメント
```

## アバター変化ロジック

body_state はゴールモードに応じて意味が変わる:

| body_state | 状態 | 意味 |
|-----------|------|------|
| 0 | ゴール達成 | 目標体重達成 or 初期値 |
| 1〜3 | ジャーニー中 | 目標に向けて変化中 |
| 4 | 要ケア | missedDays≥3 でジャーニーチェック発動 |

**アバター外見**: ゴールモード別に5体生成
- `diet` (減量): 細身(0) → ぽっちゃり(4)
- `bulk` (増量): 筋肉質(0) → 細身すぎ(4)
- `maintain` (維持): バランス良(0) → バランス崩れ(4)

**回復条件**: 3日連続ログイン + 全日運動記録(completed:true) + 直近3日活動継続 → body_state -1

## ローカル開発 (無料・AWS不要)

### 前提
- Docker / Docker Compose
- Node.js 20+

### 起動手順

```bash
# 1. Docker起動 (DynamoDB Local + LocalStack S3)
docker compose up dynamodb-local localstack -d

# 2. 環境変数設定
cp backend/.env.local.example backend/.env.local
# GEMINI_API_KEY= のままでもモックで動く
# 実際に使う場合は Google AI Studio でAPIキーを取得して設定

# 3. 依存関係インストール
cd backend && npm install

# 4. DB初期化 + APIサーバー起動
npm run start:local
# → http://localhost:3000 で起動

# 5. 動作確認
curl http://localhost:3000/health

# ユニットテスト
npm test

# 統合テスト (DynamoDB Local起動中に実行)
DYNAMODB_ENDPOINT=http://localhost:8000 JWT_SECRET=test-secret \
  npx jest --testPathPattern=integration
```

### モバイル開発

```bash
cd mobile && npm install

# iOS Simulator (APIはlocalhost:3000を向く)
npx react-native run-ios

# Android Emulator (Platform.OS === 'android' で自動的に 10.0.2.2:3000 を使用)
npx react-native run-android
```

### Gemini API（オプション）
- 未設定でもモックレスポンスで食事解析・AIアドバイス機能が動く
- 実際のAIを使いたい場合: [Google AI Studio](https://aistudio.google.com) でAPIキーを取得し `backend/.env.local` の `GEMINI_API_KEY=` に設定

## 本番デプロイ

```bash
# 初回のみ: Terraform state用リソース作成
cd infrastructure && bash bootstrap.sh

# Terraform初期化
terraform init

# デプロイ (GitHub Actions mainブランチへのpushで自動実行)
cd backend && npm run deploy:layers && npm run deploy:functions
```

## コスト目安 (500 DAU)

- DynamoDB: $2〜5/月
- Lambda + API Gateway: $1〜3/月
- Gemini API (食事解析+アドバイス): ~$2.75/月
- S3: ~$1/月
- **合計: ~$10/月**
