import { UserId } from '../shared/types';
import { User, UpdateProfileInput } from './User';
import { Goal } from './Goal';
import { Streak } from './Streak';

export interface IUserRepository {
  findById(userId: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<void>;
  updateProfile(userId: UserId, input: UpdateProfileInput): Promise<User>;

  getGoal(userId: UserId): Promise<Goal | null>;
  upsertGoal(goal: Goal): Promise<void>;
  achieveGoal(userId: UserId, achievedAt: string): Promise<void>;

  getStreak(userId: UserId): Promise<Streak | null>;
  saveStreak(streak: Streak): Promise<void>;

  createEmailIndex(email: string, userId: UserId): Promise<void>;
  upgradeToRegistered(userId: UserId, email: string, passwordHash: string): Promise<void>;
  saveFcmToken(userId: UserId, fcmToken: string): Promise<void>;
  listAllFcmTokens(): Promise<{ userId: UserId; fcmToken: string }[]>;
  deleteAccount(userId: UserId): Promise<void>;
}
