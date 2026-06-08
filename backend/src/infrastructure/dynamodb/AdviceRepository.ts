import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME, nextDayJSTEpoch } from './client';
import { UserId } from '../../domain/shared/types';

export type DailyAdvice = {
  greeting: string;
  meal_advice: string;
  exercise_advice: string;
  generatedAt: string;
  error?: string;
};

export type TokenBlacklist = {
  jti: string;
  userId: string;
  expiredAt: number;
  ttl: number;
};

export class AdviceRepository {
  async getToday(userId: UserId, todayJST: string): Promise<DailyAdvice | null> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: `ADVICE#${todayJST}` } }));
    if (!r.Item) return null;
    return r.Item as DailyAdvice;
  }

  async save(userId: UserId, todayJST: string, advice: DailyAdvice): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: `USER#${userId}`, SK: `ADVICE#${todayJST}`, ...advice, ttl: nextDayJSTEpoch() },
    }));
  }
}

export class TokenBlacklistRepository {
  async isBlacklisted(jti: string): Promise<boolean> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `RT#${jti}`, SK: 'BLACKLIST' } }));
    return !!r.Item;
  }

  async add(entry: TokenBlacklist): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: `RT#${entry.jti}`, SK: 'BLACKLIST', userId: entry.userId, expiredAt: entry.expiredAt, ttl: entry.ttl },
    }));
  }
}
