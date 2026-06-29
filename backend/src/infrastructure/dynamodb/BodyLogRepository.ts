import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IBodyLogRepository } from '../../domain/body-log/IBodyLogRepository';
import { WeightLog } from '../../domain/body-log/WeightLog';
import { ExerciseLog } from '../../domain/body-log/ExerciseLog';
import { UserId, DateString } from '../../domain/shared/types';

export class BodyLogRepository implements IBodyLogRepository {
  async saveWeight(log: WeightLog): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${log.userId}`,
        SK: `WEIGHT#${log.recordedAt}`,
        weightKg: log.weightKg,
        ...(log.bodyFatPct !== undefined ? { bodyFatPct: log.bodyFatPct } : {}),
        recordedAt: log.recordedAt,
      },
    }));
  }

  async getWeightHistory(userId: UserId, from: DateString, to: DateString, limit: number, cursor?: string): Promise<{ items: WeightLog[]; nextCursor: string | null }> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': `WEIGHT#${from}`, ':to': `WEIGHT#${to}` },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : undefined,
    }));
    const nextCursor = r.LastEvaluatedKey ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString('base64') : null;
    return { items: (r.Items ?? []).map(i => ({ userId, weightKg: i.weightKg, bodyFatPct: i.bodyFatPct, recordedAt: i.recordedAt })), nextCursor };
  }

  async saveExercise(log: ExerciseLog): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${log.userId}`,
        SK: `EXERCISE#${log.recordedAt}`,
        exerciseName: log.exerciseName,
        durationMin: log.durationMin,
        kcalBurned: log.kcalBurned,
        completed: log.completed,
        muscleGroups: log.muscleGroups,
        recordedAt: log.recordedAt,
      },
    }));
  }

  async getExerciseHistory(userId: UserId, from: DateString, to: DateString, limit: number, cursor?: string): Promise<{ items: ExerciseLog[]; nextCursor: string | null }> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': `EXERCISE#${from}`, ':to': `EXERCISE#${to}` },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : undefined,
    }));
    const nextCursor = r.LastEvaluatedKey ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString('base64') : null;
    return { items: (r.Items ?? []).map(i => this.#mapExercise(userId, i)), nextCursor };
  }

  async countExercise(userId: UserId): Promise<number> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'EXERCISE#' },
      Select: 'COUNT',
    }));
    return r.Count ?? 0;
  }

  async getRecentExercise(userId: UserId, since: DateString): Promise<ExerciseLog[]> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': `EXERCISE#${since}`, ':to': 'EXERCISE#9999' },
      ScanIndexForward: false,
    }));
    return (r.Items ?? []).map(i => this.#mapExercise(userId, i));
  }

  #mapExercise(userId: UserId, i: Record<string, unknown>): ExerciseLog {
    return {
      userId,
      exerciseName: i.exerciseName as string,
      durationMin: i.durationMin as number,
      kcalBurned: i.kcalBurned as number,
      completed: i.completed as boolean,
      muscleGroups: i.muscleGroups as string[] | undefined,
      recordedAt: i.recordedAt as string,
    };
  }
}
