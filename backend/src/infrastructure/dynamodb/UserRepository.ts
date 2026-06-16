import {
  GetCommand, PutCommand, UpdateCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { User, UpdateProfileInput } from '../../domain/user/User';
import { Goal } from '../../domain/user/Goal';
import { Streak } from '../../domain/user/Streak';
import { UserId } from '../../domain/shared/types';

export class UserRepository implements IUserRepository {
  async findById(userId: UserId): Promise<User | null> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: 'PROFILE' } }));
    if (!r.Item) return null;
    return this.#mapUser(userId, r.Item);
  }

  async findByEmail(email: string): Promise<User | null> {
    const idx = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#email#${email}`, SK: 'INDEX' } }));
    if (!idx.Item) return null;
    return this.findById(idx.Item.userId as string);
  }

  async create(user: User): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${user.userId}`,
        SK: 'PROFILE',
        isAnonymous: user.isAnonymous,
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        gender: user.gender,
        age: user.age,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        bodyFatPct: user.bodyFatPct,
        lifestyle: user.lifestyle,
        aiTone: user.aiTone,
        hasGym: user.hasGym,
        bodyBalance: user.bodyBalance,
        timezone: user.timezone,
        createdAt: user.createdAt,
        subscriptionTier: user.subscriptionTier ?? 'free',
      },
    }));
  }

  async saveFcmToken(userId: UserId, fcmToken: string): Promise<void> {
    await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET fcmToken = :t',
      ExpressionAttributeValues: { ':t': fcmToken },
    }));
  }

  async listAllFcmTokens(): Promise<{ userId: UserId; fcmToken: string }[]> {
    const r = await db.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk AND attribute_exists(fcmToken)',
      ExpressionAttributeValues: { ':sk': 'PROFILE' },
      ProjectionExpression: 'PK, fcmToken',
    }));
    return (r.Items ?? []).map(item => ({
      userId: (item.PK as string).replace('USER#', '') as UserId,
      fcmToken: item.fcmToken as string,
    }));
  }

  async deleteAccount(userId: UserId): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET deleted = :true, deletedAt = :now, #ttl = :ttl',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':true': true, ':now': new Date().toISOString(), ':ttl': ttl },
    }));
  }

  async upgradeToRegistered(userId: UserId, email: string, passwordHash: string): Promise<void> {
    await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET email = :email, passwordHash = :hash, isAnonymous = :f',
      ExpressionAttributeValues: { ':email': email, ':hash': passwordHash, ':f': false },
    }));
  }

  async createEmailIndex(email: string, userId: UserId): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: `USER#email#${email}`, SK: 'INDEX', userId },
    }));
  }

  async updateProfile(userId: UserId, input: UpdateProfileInput): Promise<User> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const exprs = Object.entries(input).map(([k, v], i) => {
      names[`#f${i}`] = k;
      values[`:v${i}`] = v;
      return `#f${i} = :v${i}`;
    });

    const r = await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: `SET ${exprs.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    return this.#mapUser(userId, r.Attributes!);
  }

  async getGoal(userId: UserId): Promise<Goal | null> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: 'GOAL#ACTIVE' } }));
    if (!r.Item) return null;
    return { userId, targetWeight: r.Item.targetWeight, mode: r.Item.mode, startedAt: r.Item.startedAt, achievedAt: r.Item.achievedAt };
  }

  async upsertGoal(goal: Goal): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: `USER#${goal.userId}`, SK: 'GOAL#ACTIVE', targetWeight: goal.targetWeight, mode: goal.mode, startedAt: goal.startedAt },
    }));
  }

  async achieveGoal(userId: UserId, achievedAt: string): Promise<void> {
    await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'GOAL#ACTIVE' },
      UpdateExpression: 'SET achievedAt = :now',
      ExpressionAttributeValues: { ':now': achievedAt },
    }));
  }

  async getStreak(userId: UserId): Promise<Streak | null> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: 'STREAK' } }));
    if (!r.Item) return null;
    return { userId, currentDays: r.Item.currentDays, longestDays: r.Item.longestDays, lastLoggedAt: r.Item.lastLoggedAt };
  }

  async saveStreak(streak: Streak): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${streak.userId}`,
        SK: 'STREAK',
        currentDays: streak.currentDays,
        longestDays: streak.longestDays,
        lastLoggedAt: streak.lastLoggedAt,
      },
    }));
  }

  #mapUser(userId: UserId, item: Record<string, unknown>): User {
    return {
      userId,
      isAnonymous: (item.isAnonymous as boolean) ?? true,
      email: item.email as string | undefined,
      displayName: (item.displayName as string) ?? '',
      passwordHash: item.passwordHash as string | undefined,
      gender: item.gender as User['gender'],
      age: item.age as number | undefined,
      heightCm: item.heightCm as number | undefined,
      weightKg: item.weightKg as number | undefined,
      bodyFatPct: item.bodyFatPct as number | undefined,
      lifestyle: (item.lifestyle as User['lifestyle']) ?? 'moderate',
      aiTone: (item.aiTone as User['aiTone']) ?? 'friendly',
      hasGym: item.hasGym as boolean | undefined,
      bodyBalance: item.bodyBalance as number | undefined,
      timezone: (item.timezone as string) ?? 'Asia/Tokyo',
      createdAt: item.createdAt as string,
      subscriptionTier: (item.subscriptionTier as User['subscriptionTier']) ?? 'free',
      deleted: item.deleted as boolean | undefined,
      deletedAt: item.deletedAt as string | undefined,
    };
  }
}
