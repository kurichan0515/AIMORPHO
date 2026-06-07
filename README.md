# YASRUN - AIアバター連動型ダイエットサポートアプリ

アバターと二人三脚で目標達成を目指すヘルスケアアプリ。

## コンセプト

ダイエットの「モチベーション維持」困難を以下で解決:

- **アバター視覚変化** — 体型5段階で進捗を可視化
- **AIパーソナライズ提案** — Gemini APIによる食事解析・毎日のアドバイス
- **ゲーミフィケーション** — ストリーク・バッジ・グループ機能

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| モバイル | React Native (iOS / Android) |
| API | AWS API Gateway (REST) + Lambda Authorizer |
| 関数実行 | AWS Lambda (6関数) |
| DB | DynamoDB シングルテーブル設計 |
| 画像保存 | S3 + Presigned URL |
| 認証 | 自前JWT (HS256) |
| AI | Gemini API (食事解析・アバター生成・アドバイス) |
| IaC | Terraform |
| CI/CD | GitHub Actions |

## リポジトリ構造

```
YASRUN/
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
│       ├── fn-ai/           # AIアドバイス・ペナルティ
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

| body_state | 状態 | 条件 |
|-----------|------|------|
| 0 | 理想体型 / 目標達成 | 初期値 or 目標体重達成 |
| 1〜3 | 中間体型 | missedDays≥3 でペナルティ |
| 4 | 最太り | body_state上限 |

**回復条件**: 3日連続ログイン + 全日運動記録(completed:true) + 直近3日平均摂取kcal ≤ TDEE → body_state -1

## 開発環境セットアップ

```bash
# 依存関係インストール (backend)
cd backend && npm install

# Terraform初期化
cd infrastructure && terraform init

# モバイル開発
cd mobile && npm install && npx react-native run-ios
```

## コスト目安 (500 DAU)

- DynamoDB: $2〜5/月
- Lambda + API Gateway: $1〜3/月
- Gemini API (食事解析+アドバイス): ~$2.75/月
- S3: ~$1/月
- **合計: ~$10/月**
