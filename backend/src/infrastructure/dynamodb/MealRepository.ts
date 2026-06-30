import { PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IMealRepository } from '../../domain/meal/IMealRepository';
import { MealLog } from '../../domain/meal/MealLog';
import { UserId, DateString } from '../../domain/shared/types';

export class MealRepository implements IMealRepository {
  async save(log: MealLog): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${log.userId}`,
        SK: `MEAL#${log.recordedAt}`,
        imageUrl: log.imageUrl,
        menuName: log.menuName,
        kcal: log.kcal,
        proteinG: log.proteinG,
        fatG: log.fatG,
        carbG: log.carbG,
        confidence: log.confidence,
        geminiRaw: log.geminiRaw,
        recordedAt: log.recordedAt,
      },
    }));
  }

  async getHistory(userId: UserId, from: DateString, to: DateString, limit: number, cursor?: string): Promise<{ items: MealLog[]; nextCursor: string | null }> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': `MEAL#${from}`, ':to': `MEAL#${to}` },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : undefined,
    }));
    const nextCursor = r.LastEvaluatedKey ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString('base64') : null;
    return { items: (r.Items ?? []).map(i => this.#map(userId, i)), nextCursor };
  }

  async count(userId: UserId): Promise<number> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'MEAL#' },
      Select: 'COUNT',
    }));
    return r.Count ?? 0;
  }

  async delete(userId: UserId, recordedAt: DateString): Promise<void> {
    await db.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `MEAL#${recordedAt}` },
    }));
  }

  async getRecent(userId: UserId, since: DateString): Promise<MealLog[]> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': `MEAL#${since}`, ':to': 'MEAL#9999' },
      ScanIndexForward: false,
    }));
    return (r.Items ?? []).map(i => this.#map(userId, i));
  }

  #map(userId: UserId, i: Record<string, unknown>): MealLog {
    return {
      userId,
      imageUrl: i.imageUrl as string,
      menuName: i.menuName as string,
      kcal: i.kcal as number,
      proteinG: i.proteinG as number,
      fatG: i.fatG as number,
      carbG: i.carbG as number,
      confidence: i.confidence as MealLog['confidence'],
      geminiRaw: i.geminiRaw as string,
      recordedAt: i.recordedAt as string,
    };
  }
}
