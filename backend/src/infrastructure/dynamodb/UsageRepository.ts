import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { db, TABLE_NAME, nextDayJSTEpoch } from './client';
import { IUsageRepository } from '../../domain/usage/IUsageRepository';
import { UsageType } from '../../domain/usage/UsageLimits';
import { UserId } from '../../domain/shared/types';

export class UsageRepository implements IUsageRepository {
  async tryIncrement(userId: UserId, todayJST: string, type: UsageType, limit: number): Promise<boolean> {
    try {
      await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: `USAGE#${todayJST}` },
        UpdateExpression: 'SET #t = if_not_exists(#t, :zero) + :one, #ttl = :ttl',
        ConditionExpression: 'attribute_not_exists(#t) OR #t < :limit',
        ExpressionAttributeNames: { '#t': type, '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':limit': limit, ':ttl': nextDayJSTEpoch() },
      }));
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }

  async getUsage(userId: UserId, todayJST: string): Promise<Record<UsageType, number>> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: `USAGE#${todayJST}` } }));
    return {
      mealAnalysis: (r.Item?.mealAnalysis as number) ?? 0,
      mealSuggestion: (r.Item?.mealSuggestion as number) ?? 0,
      exerciseSuggestion: (r.Item?.exerciseSuggestion as number) ?? 0,
    };
  }
}
