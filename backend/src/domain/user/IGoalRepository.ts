import { UserId } from '../shared/types';
import { Goal } from './Goal';

export interface IGoalRepository {
  getGoal(userId: UserId): Promise<Goal | null>;
  upsertGoal(goal: Goal): Promise<void>;
  achieveGoal(userId: UserId, achievedAt: string): Promise<void>;
}
