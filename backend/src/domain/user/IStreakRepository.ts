import { UserId } from '../shared/types';
import { Streak } from './Streak';

export interface IStreakRepository {
  getStreak(userId: UserId): Promise<Streak | null>;
  saveStreak(streak: Streak): Promise<void>;
}
