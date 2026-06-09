# AIMORPHO システム設計書 v1.1

## 1. DynamoDBシングルテーブル設計

### テーブル構造

#### ユーザー系

| エンティティ | PK | SK | 主な属性 |
|---|---|---|---|
| User | USER#\<userId\> | PROFILE | email, displayName, age, heightCm, weightKg, bodyFatPct, lifestyle, aiTone, bodyPhotoKey, bodyBalance, timezone, createdAt |
| Goal | USER#\<userId\> | GOAL#ACTIVE | targetWeight, mode(diet\|maintain\|bulk), startedAt, achievedAt |
| Avatar | USER#\<userId\> | AVATAR | facePhotoKey, avatarImages{0-4}(s3Url), bodyState(0-4), missedDays, bodyBalance, regenerateCount, updatedAt |
| Streak | USER#\<userId\> | STREAK | currentDays, longestDays, lastLoggedAt |
| RT Blacklist | RT#\<jti\> | BLACKLIST | userId, expiredAt (TTL) |

#### 記録系

| エンティティ | PK | SK | 主な属性 |
|---|---|---|---|
| WeightLog | USER#\<userId\> | WEIGHT#\<ISO8601\> | weightKg, recordedAt |
| MealLog | USER#\<userId\> | MEAL#\<ISO8601\> | imageUrl, menuName, kcal, proteinG, fatG, carbG, geminiRaw, confidence |
| ExerciseLog | USER#\<userId\> | EXERCISE#\<ISO8601\> | exerciseName, durationMin, kcalBurned, completed, recordedAt |
| AI Advice Cache | USER#\<userId\> | ADVICE#\<YYYY-MM-DD\> | exerciseAdvice, mealAdvice, greeting, generatedAt, ttl |

#### バッジ・グループ系

| エンティティ | PK | SK | GSI属性 |
|---|---|---|---|
| Badge定義 | BADGE#\<badgeId\> | META | — |
| UserBadge | USER#\<userId\> | BADGE#\<badgeId\> | GSI1PK: BADGE#\<badgeId\> |
| Group | GROUP#\<groupId\> | META | GSI1PK: INVITE#\<inviteCode\> |
| GroupMember | GROUP#\<groupId\> | MEMBER#\<userId\> | GSI1PK: USER#\<userId\> GSI1SK: GROUP#\<groupId\> |

### GSI設計

GSI1本のみ (コスト最小化)

| GSI名 | GSI PK | GSI SK | 解決パターン |
|---|---|---|---|
| GSI1 | GSI1PK | GSI1SK | 招待コードでグループ検索 / ユーザー所属グループ一覧 |

投影: KEYS_ONLY または INCLUDE (必要属性のみ) — ALL禁止

---

## 2. API エンドポイント

### 認証 /auth/*

| Method | Path | 説明 |
|---|---|---|
| POST | /auth/register | 新規登録 |
| POST | /auth/login | ログイン → JWT発行 |
| POST | /auth/refresh | アクセストークン更新 |
| POST | /auth/logout | RTブラックリスト登録 |

### ユーザー /users/* (JWT必須)

| Method | Path | 説明 |
|---|---|---|
| GET | /users/me | プロフィール取得 |
| PUT | /users/me | プロフィール更新 |
| GET | /users/me/goal | アクティブ目標取得 |
| POST | /users/me/goal | 目標設定・更新 |
| GET | /users/me/streak | ストリーク取得 |
| GET | /users/me/badges | バッジ一覧 |

### アバター /avatar/*

| Method | Path | 説明 |
|---|---|---|
| GET | /avatar/upload-url | 顔写真用Presigned URL取得 |
| POST | /avatar/generate | アニメ風アバター5枚生成 |
| PUT | /avatar/state | body_state更新 |

### 記録 /logs/*

| Method | Path | 説明 |
|---|---|---|
| POST | /logs/weight | 体重記録 |
| GET | /logs/weight | 体重履歴 |
| GET | /logs/meal/upload-url | 食事画像Presigned URL |
| POST | /logs/meal | 食事解析 |
| GET | /logs/meal | 食事履歴 |
| POST | /logs/exercise | 運動記録 |
| GET | /logs/exercise | 運動履歴 |

### AI /ai/*

| Method | Path | 説明 |
|---|---|---|
| GET | /ai/daily-advice | 1日1回キャッシュ付きアドバイス |
| POST | /ai/penalty-event | 未ログインジャーニーチェック処理 |
| GET | /ai/goal-message | ゴール達成メッセージ |

### ソーシャル /groups/*

| Method | Path | 説明 |
|---|---|---|
| POST | /groups | グループ作成 |
| POST | /groups/join | invite_codeで参加 |
| GET | /groups/:group_id | グループ情報 |
| GET | /groups/:group_id/feed | メンバーフィード |
| DELETE | /groups/:group_id/leave | 退出 |

---

## 3. JWT仕様

| 項目 | 値 |
|---|---|
| アルゴリズム | HS256 |
| シークレット管理 | AWS Secrets Manager |
| accessToken TTL | 15分 |
| refreshToken TTL | 30日 |
| RTブラックリスト | DynamoDB RT#\<jti\> TTL自動削除 |

---

## 4. アバター変化ロジック

### body_state = 0（ゴール達成）の定義

| goalMode | 達成条件 |
|---|---|
| diet | currentWeight ≤ targetWeight |
| bulk | currentWeight ≥ targetWeight |
| maintain | \|currentWeight - targetWeight\| ≤ 1.0kg |

### body_state遷移

| 条件 | body_state | missedDays | streak |
|---|---|---|---|
| missedDays ≤ 1 | 変化なし | 変化なし | 通常加算 |
| missedDays ≥ 3 + NO | MIN(+1, 4) | 0リセット | 0リセット |
| missedDays ≥ 3 + YES | 変化なし | 0リセット | 0リセット |
| 目標体重達成 | 0リセット | 0リセット | 維持 |

### アバター外見（goalMode別）

| state | diet | bulk | maintain |
|---|---|---|---|
| 0 | 引き締まった細身（理想） | 筋肉質がっしり（理想） | バランス良く引き締まり（理想） |
| 4 | ぽっちゃり（目標から遠い） | 非常に細身（目標から遠い） | バランス崩れ（要ケア） |

### 回復条件

3日連続ログイン + 全日運動(completed:true) + 以下のカロリー条件 → body_state -1

| goalMode | カロリー条件 |
|---|---|
| diet | 直近3日平均 ≤ TDEE |
| bulk | 直近3日平均 ≥ TDEE |
| maintain | 直近3日平均が TDEE ± 10% 以内 |

### BMR計算式

Mifflin-St Jeor式 + ライフスタイル活動係数 (1.2 / 1.375 / 1.55 / 1.725 / 1.9)

---

## 5. Lambda構成

| 関数名 | エンドポイント | メモリ | タイムアウト | Provisioned |
|---|---|---|---|---|
| fn-auth | /auth/* | 128MB | 5s | 不要 |
| fn-user | /users/* | 128MB | 10s | 不要 |
| fn-log | /logs/weight, /logs/exercise | 256MB | 15s | 不要 |
| fn-meal | /logs/meal | 512MB | 30s | 検討 |
| fn-ai | /ai/* | 512MB | 30s | 検討 |
| fn-avatar | /avatar/* | 512MB | 90s | 検討 |
| fn-social | /groups/* | 128MB | 10s | 不要 |

### Lambda Layer

| Layer | 内容 |
|---|---|
| layer-db | DynamoDBクライアント・QueryHelper・TTL計算 |
| layer-auth | JWT検証・bcryptラッパー・エラーレスポンス整形 |
| layer-gemini | Gemini APIクライアント・プロンプトテンプレート・JSONパース |

---

## 6. Gemini API連携

### 食事解析フロー

1. GET /logs/meal/upload-url → Presigned URL発行
2. モバイル → S3直接PUT
3. POST /logs/meal { s3Key } → Lambda → S3 base64取得 → Gemini解析
4. レスポンス: { menu_name, kcal, protein_g, fat_g, carb_g, confidence }
5. DynamoDB保存 → 201返却

### フォールバック

| 状況 | 挙動 |
|---|---|
| Gemini timeout (30s超) | { error: "analysis_failed" } 201。クライアント手動入力へ |
| JSONパース失敗 | 同上。gemini_rawに生レスポンス保存 |
| confidence: low | クライアント側確認・修正UI表示 |

### AIアドバイスキャッシュ

- 1日1回生成 + DynamoDB TTL (翌日0時epoch)
- コンテキスト: age, height, currentWeight, targetWeight, goalMode(diet|bulk|maintain), lifestyle, aiTone, 直近7日体重, 直近3日食事kcal, 直近3日運動, streak, bodyState
- 500DAU月額: ~$0.5/月 (キャッシュ有) vs ~$15/月 (毎回生成)

---

## 7. Terraform構成

| モジュール | 主なリソース |
|---|---|
| modules/dynamodb | aws_dynamodb_table, GSI x1, TTL, PAY_PER_REQUEST |
| modules/lambda | aws_lambda_function x7, layer x3, Provisioned Concurrency |
| modules/api_gateway | REST API, Lambda Authorizer, stage, deploy |
| modules/s3 | 画像バケット, ライフサイクル(90日→Glacier), CORS |
| modules/iam | 実行ロール, DynamoDB/S3/SecretsManager ポリシー |
| modules/secrets | JWT_SECRET, GEMINI_API_KEY |

Terraformステート: S3バックエンド (aimorpho-tfstate) + DynamoDBロック (aimorpho-tflock)
