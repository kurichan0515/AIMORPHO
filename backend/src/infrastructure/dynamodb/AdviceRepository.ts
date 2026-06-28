import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME, nextDayJSTEpoch } from './client';
import { IAdviceRepository } from '../../domain/advice/IAdviceRepository';
import { DailyAdvice } from '../../domain/advice/Advice';
import { UserId } from '../../domain/shared/types';

export class AdviceRepository implements IAdviceRepository {
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
