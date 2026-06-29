import { UserId } from '../shared/types';
import { User, UpdateProfileInput } from './User';

export interface IUserRepository {
  findById(userId: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<void>;
  updateProfile(userId: UserId, input: UpdateProfileInput): Promise<User>;
  createEmailIndex(email: string, userId: UserId): Promise<void>;
  upgradeToRegistered(userId: UserId, email: string, passwordHash: string): Promise<void>;
  saveFcmToken(userId: UserId, fcmToken: string): Promise<void>;
  updateSubscriptionTier(
    userId: UserId,
    tier: 'free' | 'premium',
    meta: { expiresAt: string; store: 'apple' | 'google'; productId: string; transactionId: string }
  ): Promise<void>;
  listAllFcmTokens(): Promise<{ userId: UserId; fcmToken: string }[]>;
  listFcmTokensWithStreak(): Promise<{ userId: UserId; fcmToken: string; lastLoggedAt?: string; notificationsEnabled?: boolean }[]>;
  deleteAccount(userId: UserId): Promise<void>;
  restoreAccount(userId: UserId): Promise<void>;
}
