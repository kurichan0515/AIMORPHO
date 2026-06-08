import { UserId, GoalMode, DateString } from '../shared/types';

export type Goal = {
  userId: UserId;
  targetWeight: number;
  mode: GoalMode;
  startedAt: DateString;
  achievedAt?: DateString;
};
