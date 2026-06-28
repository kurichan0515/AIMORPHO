import { UserId, DateString } from '../shared/types';
import { MealLog } from './MealLog';

export interface IMealRepository {
  save(log: MealLog): Promise<void>;
  getHistory(userId: UserId, from: DateString, to: DateString, limit: number): Promise<MealLog[]>;
  count(userId: UserId): Promise<number>;
  countMonth(userId: UserId, yearMonth: string): Promise<number>;
  getRecent(userId: UserId, since: DateString): Promise<MealLog[]>;
}
