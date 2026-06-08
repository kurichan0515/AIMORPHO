import { UserId, DateString } from '../shared/types';

export type MealLog = {
  userId: UserId;
  imageUrl: string;
  menuName: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  confidence: 'high' | 'medium' | 'low';
  geminiRaw: string;
  recordedAt: DateString;
};
