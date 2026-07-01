import { PutCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IRewardTokenRepository } from '../../domain/reward/IRewardTokenRepository';
import { RewardToken } from '../../domain/reward/RewardToken';

export class RewardTokenRepository implements IRewardTokenRepository {
  async create(token: RewardToken): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `REWARD_TOKEN#${token.tokenId}`,
        SK: 'META',
        userId: token.userId,
        createdAt: token.createdAt,
        ttl: token.ttl,
        verified: false,
      },
    }));
  }

  async findById(tokenId: string): Promise<RewardToken | null> {
    const r = await db.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `REWARD_TOKEN#${tokenId}`, SK: 'META' },
    }));
    if (!r.Item) { return null; }
    return {
      tokenId,
      userId: r.Item.userId,
      createdAt: r.Item.createdAt,
      ttl: r.Item.ttl,
      verified: r.Item.verified ?? false,
    };
  }

  async markVerified(tokenId: string): Promise<void> {
    await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `REWARD_TOKEN#${tokenId}`, SK: 'META' },
      UpdateExpression: 'SET verified = :true',
      ExpressionAttributeValues: { ':true': true },
    }));
  }

  async delete(tokenId: string): Promise<void> {
    await db.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `REWARD_TOKEN#${tokenId}`, SK: 'META' },
    }));
  }

  async findAndDeleteVerified(tokenId: string, userId: string): Promise<boolean> {
    try {
      await db.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: `REWARD_TOKEN#${tokenId}`, SK: 'META' },
        ConditionExpression: 'userId = :uid AND verified = :true',
        ExpressionAttributeValues: { ':uid': userId, ':true': true },
      }));
      return true;
    } catch (e: any) {
      if (e.name === 'ConditionalCheckFailedException') { return false; }
      throw e;
    }
  }
}
