import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const TABLE    = process.env.DYNAMODB_TABLE    ?? 'yasrun';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const db = DynamoDBDocumentClient.from(client);

const LIFESTYLES  = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
const AI_TONES    = ['friendly', 'strict', 'gentle', 'cool'] as const;
const GENDERS     = ['male', 'female', 'other'] as const;
const TIERS       = ['free', 'free', 'free', 'free', 'premium'] as const;

const NAMES = [
  '田中 太郎', '鈴木 花子', '佐藤 健', '山田 優子', '伊藤 誠',
  '渡辺 さくら', '中村 拓海', '小林 美咲', '加藤 翔', '吉田 凛',
  '山本 大輝', '松本 愛', '井上 蓮', '木村 陽菜', '林 颯太',
  '清水 莉子', '山口 悠人', '高橋 菜々', '石川 湊', '中島 葵',
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

async function seedUsers() {
  console.log(`テーブル: ${TABLE} (${ENDPOINT})`);

  for (let i = 0; i < 20; i++) {
    const userId = crypto.randomUUID();
    const gender = pick(GENDERS);
    const isMale = gender === 'male';
    const tier   = pick(TIERS);
    const hasFcm = Math.random() > 0.35;

    const user = {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      isAnonymous: false,
      email: `user${i + 1}@example.com`,
      displayName: NAMES[i],
      gender,
      age: randInt(18, 55),
      heightCm: isMale ? randInt(162, 185) : randInt(150, 170),
      weightKg: isMale ? randInt(55, 90) : randInt(43, 70),
      bodyFatPct: isMale ? randInt(10, 28) : randInt(18, 35),
      lifestyle: pick(LIFESTYLES),
      aiTone: pick(AI_TONES),
      hasGym: Math.random() > 0.5,
      bodyBalance: randInt(-20, 20),
      timezone: 'Asia/Tokyo',
      createdAt: daysAgo(randInt(10, 180)),
      subscriptionTier: tier,
      ...(tier === 'premium' ? {
        subscriptionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        subscriptionStore: pick(['apple', 'google'] as const),
        subscriptionProductId: 'aimorpho.premium.monthly',
        subscriptionTransactionId: crypto.randomUUID(),
      } : {}),
      ...(hasFcm ? { fcmToken: `fcm_mock_token_${userId.slice(0, 8)}` } : {}),
      notificationsEnabled: hasFcm,
    };

    await db.send(new PutCommand({ TableName: TABLE, Item: user }));

    // 体重ログ（直近30日、週2〜3回）
    const baseWeight = user.weightKg;
    for (let d = 30; d >= 0; d -= randInt(2, 4)) {
      const recordedAt = daysAgo(d);
      await db.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${userId}`, SK: `WEIGHT#${recordedAt}`,
          weightKg: +(baseWeight + (Math.random() - 0.5) * 4).toFixed(1),
          bodyFatPct: +(user.bodyFatPct! + (Math.random() - 0.5) * 2).toFixed(1),
          recordedAt,
        },
      }));
    }

    // 食事ログ（直近14日、1〜3食/日）
    for (let d = 14; d >= 0; d--) {
      const meals = randInt(1, 3);
      for (let m = 0; m < meals; m++) {
        const recordedAt = new Date(Date.now() - d * 86400000 + m * 21600000 + randInt(0, 3600000)).toISOString();
        const kcal = randInt(300, 900);
        await db.send(new PutCommand({
          TableName: TABLE,
          Item: {
            PK: `USER#${userId}`, SK: `MEAL#${recordedAt}`,
            imageUrl: `meals/${userId}/mock_${d}_${m}.jpg`,
            menuName: pick(['定食', 'パスタ', 'サラダ', 'ラーメン', 'カレー', 'サンドイッチ', '焼き魚', '鍋', 'うどん', 'ピザ']),
            kcal,
            proteinG: +(kcal * 0.15 / 4).toFixed(1),
            fatG:     +(kcal * 0.30 / 9).toFixed(1),
            carbG:    +(kcal * 0.55 / 4).toFixed(1),
            confidence: pick(['high', 'high', 'medium', 'low'] as const),
            geminiRaw: '{}',
            recordedAt,
          },
        }));
      }
    }

    // 運動ログ（直近14日、週3〜4回）
    for (let d = 14; d >= 0; d -= randInt(1, 3)) {
      const recordedAt = daysAgo(d);
      await db.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${userId}`, SK: `EXERCISE#${recordedAt}`,
          exerciseName: pick(['ランニング', 'ウォーキング', '筋トレ', '水泳', 'サイクリング', 'ヨガ', 'HIIT']),
          durationMin: randInt(20, 60),
          kcalBurned: randInt(100, 500),
          completed: Math.random() > 0.1,
          muscleGroups: [pick(['全身', '下半身', '上半身', '体幹', '有酸素'])],
          recordedAt,
        },
      }));
    }

    console.log(`✅ ${NAMES[i]} (${userId.slice(0, 8)}...) ${tier} ${hasFcm ? '🔔' : '🔕'}`);
  }

  console.log('\n🚀 モックユーザー20件 + ログデータ投入完了');
}

seedUsers().catch(err => {
  console.error('❌ 失敗:', err.message);
  process.exit(1);
});
