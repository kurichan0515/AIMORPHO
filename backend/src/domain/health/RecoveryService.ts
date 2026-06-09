import { ExerciseLog } from '../body-log/ExerciseLog';
import { calcTDEE } from './HealthCalc';
import { User } from '../user/User';

export type RecoveryInput = {
  streakDays: number;
  recentExercise: ExerciseLog[];
  recentKcal3days: number[];
  tdee: number;
  goalMode?: string;
};

export const checkRecoveryCondition = ({ streakDays, recentExercise, recentKcal3days, tdee, goalMode }: RecoveryInput): boolean => {
  if (streakDays < 3) return false;
  const allExercised = recentExercise.length >= 3 && recentExercise.every(e => e.completed);
  if (!allExercised) return false;
  const avgKcal = recentKcal3days.reduce((s, v) => s + v, 0) / 3;
  if (goalMode === 'bulk')     return avgKcal >= tdee;
  if (goalMode === 'maintain') return Math.abs(avgKcal - tdee) <= tdee * 0.1;
  return avgKcal <= tdee;
};

export const calcUserTDEE = (user: Pick<User, 'gender' | 'weightKg' | 'heightCm' | 'age' | 'lifestyle'>): number => {
  if (!user.weightKg || !user.heightCm || !user.age) return 2000;
  return calcTDEE({
    gender: user.gender,
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    lifestyle: user.lifestyle,
  });
};
