import { UserId } from '../shared/types';
import { DailyAdvice } from './Advice';

export interface IAdviceRepository {
  getToday(userId: UserId, todayJST: string): Promise<DailyAdvice | null>;
  save(userId: UserId, todayJST: string, advice: DailyAdvice): Promise<void>;
}
