import { UserId, DateString } from '../shared/types';
import { WeightLog } from './WeightLog';
import { ExerciseLog } from './ExerciseLog';

export interface IBodyLogRepository {
  saveWeight(log: WeightLog): Promise<void>;
  getWeightHistory(userId: UserId, from: DateString, to: DateString, limit: number, cursor?: string): Promise<{ items: WeightLog[]; nextCursor: string | null }>;

  saveExercise(log: ExerciseLog): Promise<void>;
  getExerciseHistory(userId: UserId, from: DateString, to: DateString, limit: number, cursor?: string): Promise<{ items: ExerciseLog[]; nextCursor: string | null }>;
  countExercise(userId: UserId): Promise<number>;
  getRecentExercise(userId: UserId, since: DateString): Promise<ExerciseLog[]>;
}
