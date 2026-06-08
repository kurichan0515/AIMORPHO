import { UserId, DateString } from '../shared/types';

export type ExerciseLog = {
  userId: UserId;
  exerciseName: string;
  durationMin: number;
  kcalBurned: number;
  completed: boolean;
  recordedAt: DateString;
};
