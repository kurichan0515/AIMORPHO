import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';

export type LegalFile = 'terms' | 'privacy';

export interface LegalHistoryEntry {
  key: string;
  activatedAt: string;
}

export interface LegalConfig {
  currentKey: string;
  activatedAt: string;
  history: LegalHistoryEntry[];
}

export class LegalRepository {
  async get(file: LegalFile): Promise<LegalConfig | null> {
    const r = await db.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: 'CONFIG', SK: `LEGAL#${file}` },
    }));
    if (!r.Item) return null;
    return {
      currentKey:  r.Item.currentKey as string,
      activatedAt: r.Item.activatedAt as string,
      history:     (r.Item.history ?? []) as LegalHistoryEntry[],
    };
  }

  async activate(file: LegalFile, key: string): Promise<void> {
    const current = await this.get(file);
    const now = new Date().toISOString();
    const prevEntries: LegalHistoryEntry[] = current
      ? [{ key: current.currentKey, activatedAt: current.activatedAt }, ...current.history]
      : [];
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: 'CONFIG',
        SK: `LEGAL#${file}`,
        currentKey:  key,
        activatedAt: now,
        history:     prevEntries.slice(0, 20),
      },
    }));
  }
}
