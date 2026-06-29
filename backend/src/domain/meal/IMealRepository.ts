import { UserId, DateString } from '../shared/types';
import { MealLog } from './MealLog';

export interface IMealRepository {
  save(log: MealLog): Promise<void>;
  delete(userId: UserId, recordedAt: DateString): Promise<void>;
  getHistory(userId: UserId, from: DateString, to: DateString, limit: number, cursor?: string): Promise<{ items: MealLog[]; nextCursor: string | null }>;
  count(userId: UserId): Promise<number>;
  countMonth(userId: UserId, yearMonth: string): Promise<number>;
  getRecent(userId: UserId, since: DateString): Promise<MealLog[]>;
}
