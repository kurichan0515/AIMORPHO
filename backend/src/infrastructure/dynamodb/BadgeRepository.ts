import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IBadgeRepository } from '../../domain/badge/IBadgeRepository';
import { Badge, BADGE_DEFINITIONS } from '../../domain/badge/Badge';
import { UserId, BadgeId } from '../../domain/shared/types';

export class BadgeRepository implements IBadgeRepository {
  async find(userId: UserId, badgeId: BadgeId): Promise<Badge | null> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: `BADGE#${badgeId}` } }));
    if (!r.Item) return null;
    return this.#map(userId, r.Item);
  }

  async save(badge: Badge): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${badge.userId}`,
        SK: `BADGE#${badge.badgeId}`,
        badgeId: badge.badgeId,
        name: badge.name,
        description: badge.description,
        earnedAt: badge.earnedAt,
        GSI1PK: `BADGE#${badge.badgeId}`,
        GSI1SK: `USER#${badge.userId}`,
      },
    }));
  }

  async listByUser(userId: UserId): Promise<Badge[]> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'BADGE#' },
    }));
    return (r.Items ?? []).map(i => this.#map(userId, i));
  }

  async getAcquisitionStats(): Promise<{ badgeId: string; count: number }[]> {
    const results = await Promise.all(
      BADGE_DEFINITIONS.map(async def => {
        const r = await db.send(new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: { ':pk': `BADGE#${def.id}` },
          Select: 'COUNT',
        }));
        return { badgeId: def.id, count: r.Count ?? 0 };
      })
    );
    return results;
  }

  #map(userId: UserId, i: Record<string, unknown>): Badge {
    return {
      userId,
      badgeId: i.badgeId as string,
      name: i.name as string,
      description: i.description as string,
      earnedAt: i.earnedAt as string,
    };
  }
}

export interface TrophyStat {
  badgeId: string;
  count: number;
  rate: number;
}

export function buildTrophyStats(
  raw: { badgeId: string; count: number }[],
  totalUsers: number,
): TrophyStat[] {
  const statsMap = new Map(raw.map(s => [s.badgeId, s.count]));
  return BADGE_DEFINITIONS.map(def => {
    const count = statsMap.get(def.id) ?? 0;
    return {
      badgeId: def.id,
      count,
      rate: totalUsers > 0 ? Math.round(count / totalUsers * 1000) / 10 : 0,
    };
  });
}
