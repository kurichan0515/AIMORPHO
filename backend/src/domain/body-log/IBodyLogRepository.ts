import { UserId, DateString } from '../shared/types';
import { WeightLog } from './WeightLog';
import { ExerciseLog } from './ExerciseLog';

export interface IBodyLogRepository {
  saveWeight(log: WeightLog): Promise<void>;
  getWeightHistory(userId: UserId, from: DateString, to: DateString, limit: number, cursor?: string): Promise<{ items: WeightLog[]; nextCursor: string | null }>;
  deleteWeight(userId: UserId, recordedAt: DateString): Promise<void>;

  saveExercise(log: ExerciseLog): Promise<void>;
  getExerciseHistory(userId: UserId, from: DateString, to: DateString, limit: number, cursor?: string): Promise<{ items: ExerciseLog[]; nextCursor: string | null }>;
  countExercise(userId: UserId): Promise<number>;
  deleteExercise(userId: UserId, recordedAt: DateString): Promise<void>;
  getRecentExercise(userId: UserId, since: DateString): Promise<ExerciseLog[]>;
}
