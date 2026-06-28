import { UserId, DateString } from '../shared/types';

export type WeightLog = {
  userId: UserId;
  weightKg: number;
  bodyFatPct?: number;
  recordedAt: DateString;
};
