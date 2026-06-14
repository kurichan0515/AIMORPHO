import { UserId, Lifestyle, AiTone, Gender, DateString } from '../shared/types';

export type User = {
  userId: UserId;
  isAnonymous: boolean;
  email?: string;
  displayName: string;
  passwordHash?: string;
  gender?: Gender;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number;
  lifestyle: Lifestyle;
  aiTone: AiTone;
  hasGym?: boolean;
  bodyBalance?: number;
  timezone: string;
  createdAt: DateString;
  fcmToken?: string;
  subscriptionTier?: 'free' | 'premium';
};

export type UserProfile = Omit<User, 'passwordHash'>;

export type UpdateProfileInput = Partial<Pick<User,
  'displayName' | 'age' | 'heightCm' | 'weightKg' | 'bodyFatPct' | 'lifestyle' | 'aiTone' | 'hasGym' | 'bodyBalance'
>>;
