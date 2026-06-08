import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { Avatar } from '../../domain/avatar/Avatar';
import { UserId } from '../../domain/shared/types';

export class AvatarRepository implements IAvatarRepository {
  async get(userId: UserId): Promise<Avatar | null> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: 'AVATAR' } }));
    if (!r.Item) return null;
    return this.#map(userId, r.Item);
  }

  async save(avatar: Avatar): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${avatar.userId}`,
        SK: 'AVATAR',
        facePhotoKey: avatar.facePhotoKey,
        avatarImages: avatar.avatarImages,
        bodyState: avatar.bodyState,
        missedDays: avatar.missedDays,
        bodyBalance: avatar.bodyBalance,
        regenerateCount: avatar.regenerateCount,
        updatedAt: avatar.updatedAt,
      },
    }));
  }

  async updateBodyState(userId: UserId, bodyState: number, updatedAt: string): Promise<Avatar> {
    const r = await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'AVATAR' },
      UpdateExpression: 'SET bodyState = :bs, updatedAt = :now',
      ExpressionAttributeValues: { ':bs': bodyState, ':now': updatedAt },
      ReturnValues: 'ALL_NEW',
    }));
    return this.#map(userId, r.Attributes!);
  }

  #map(userId: UserId, i: Record<string, unknown>): Avatar {
    return {
      userId,
      facePhotoKey: i.facePhotoKey as string | undefined,
      avatarImages: (i.avatarImages ?? {}) as Avatar['avatarImages'],
      bodyState: (i.bodyState ?? 0) as Avatar['bodyState'],
      missedDays: (i.missedDays ?? 0) as number,
      bodyBalance: i.bodyBalance as number | undefined,
      regenerateCount: (i.regenerateCount ?? 0) as number,
      updatedAt: i.updatedAt as string,
    };
  }
}
