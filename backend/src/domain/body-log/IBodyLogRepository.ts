import { UserId, DateString } from '../shared/types';
import { WeightLog } from './WeightLog';
import { ExerciseLog } from './ExerciseLog';

export interface IBodyLogRepository {
  saveWeight(log: WeightLog): Promise<void>;
  getWeightHistory(userId: UserId, from: DateString, to: DateString, limit: number): Promise<WeightLog[]>;

  saveExercise(log: ExerciseLog): Promise<void>;
  getExerciseHistory(userId: UserId, from: DateString, to: DateString, limit: number): Promise<ExerciseLog[]>;
  countExercise(userId: UserId): Promise<number>;
  getRecentExercise(userId: UserId, since: DateString): Promise<ExerciseLog[]>;
}
