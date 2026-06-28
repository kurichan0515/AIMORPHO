# 実機テスト手順

## 前提条件

- Android実機（Android 11以上推奨）
- Node.js / JDK 17 / Android SDK インストール済み
- Docker Desktop 起動済み
- WSL環境で実行

---

## 1. バックエンド起動

```bash
cd /home/kurichan0515/hobby/AIMORPHO

# .env.local が未作成の場合
# cp backend/.env.local.example backend/.env.local

docker-compose up -d
```

起動確認:

```bash
curl http://localhost:3000/health
# → 200 OK
```

> **注意:** Android実機からバックエンドに接続する場合、PCのローカルIPが必要。
> `client.ts` の `BASE_URL` はAndroidの場合 `http://192.168.1.4:3001` 固定。
> PCのIPが変わったら [mobile/src/api/client.ts](../mobile/src/api/client.ts) を更新。

---

## 2. バックエンドIP確認（Android実機用）

```bash
# PCのローカルIPを確認
ip addr show | grep "inet " | grep -v 127.0.0.1
# または
hostname -I
```

[mobile/src/api/client.ts](../mobile/src/api/client.ts) の該当行:

```ts
Platform.OS === 'android' ? 'http://<YOUR_PC_IP>:3000' : 'http://localhost:3000'
```

現在の設定: `http://192.168.1.4:3001`（ポートが `3001` になっているが Docker は `3000` 。必要に応じて修正）

---

## 3. Metroサーバー起動

```bash
cd /home/kurichan0515/hobby/AIMORPHO/mobile
npm start
```

別ターミナルで実行。Metroが起動したらアプリビルドへ。

---

## 4. Android実機接続（ワイヤレス）

USB不要。Android 11以上はワイヤレスデバッグで完結。

### Android 11以上（ワイヤレスデバッグ）

1. Androidの「開発者オプション」→「ワイヤレスデバッグ」ON
2. 「デバイスのペアリング（ペアリングコード）」から WSL で:

```bash
adb pair <デバイスIP>:<ペアリングポート>
# → ペアリングコード入力
adb connect <デバイスIP>:<デバッグポート>
adb devices  # 接続確認
```

### Android 10以下（初回のみUSB必要）

```bash
# USB接続した状態で
adb tcpip 5555
# USB抜いて
adb connect <デバイスIP>:5555
adb devices
```

### ビルド＆インストール

```bash
cd /home/kurichan0515/hobby/AIMORPHO/mobile
npm run android
```

---

## 5. テスト項目チェックリスト

### 認証フロー

- [ ] 新規登録
- [ ] ログイン
- [ ] トークン切れ → 自動リフレッシュ
- [ ] ログアウト

### 食事記録フロー（現ブランチ: `feat/ai-usage-limit-meal-confirm-flow`）

- [ ] 食事写真撮影 or ライブラリ選択
- [ ] AI解析実行
- [ ] AI使用制限に達した場合の表示
- [ ] 確認画面の表示・修正・保存

### カメラ・権限

- [ ] カメラ権限ダイアログ表示
- [ ] 写真ライブラリ権限ダイアログ表示
- [ ] 権限拒否時の挙動

### その他

- [ ] ホーム画面表示
- [ ] ナビゲーション動作
- [ ] プッシュ通知受信

---

## 6. ログ確認

```bash
# Android実機/エミュレータのログ
adb logcat | grep -E "ReactNative|AIMORPHO|Error"

# Metroのログ → ターミナル3で確認

# バックエンドログ
docker-compose logs -f api
```

---

## 7. よくある問題

### `ECONNREFUSED` / API接続失敗（Android実機）

- PCのIPアドレスを確認して `client.ts` を更新
- Androidデバイスと PC が同一Wi-Fiに接続されているか確認
- ファイアウォールでポート3000が許可されているか確認

### Metro接続エラー

```bash
# Metroキャッシュクリア
npm start -- --reset-cache
```

### ビルドエラー（Android）

```bash
cd android && ./gradlew clean && cd ..
npm run android
```

### Docker起動失敗

```bash
docker-compose down -v
docker-compose up -d
```

---

## 8. テスト終了

```bash
# バックエンド停止
docker-compose down
```
