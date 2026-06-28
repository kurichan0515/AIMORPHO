import { UserId } from '../shared/types';
import { UsageType } from './UsageLimits';

export interface IUsageRepository {
  /** 利用回数を1増やす。limit到達済みならfalseを返し増やさない */
  tryIncrement(userId: UserId, todayJST: string, type: UsageType, limit: number): Promise<boolean>;
  getUsage(userId: UserId, todayJST: string): Promise<Record<UsageType, number>>;
}
