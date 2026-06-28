import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { ITokenBlacklistRepository, TokenBlacklist } from '../../domain/auth/ITokenBlacklistRepository';

export class TokenBlacklistRepository implements ITokenBlacklistRepository {
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
