import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IBadgeRepository } from '../../domain/badge/IBadgeRepository';
import { Badge } from '../../domain/badge/Badge';
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
