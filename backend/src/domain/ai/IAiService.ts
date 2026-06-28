import { AiTone } from '../shared/types';
import type {
  MealAnalysis,
  DailyAdviceContext, DailyAdviceResult,
  MealSuggestionContext, MealSuggestionResult,
  ExerciseSuggestionContext, ExerciseSuggestionResult,
  AvatarImageResult,
} from './AiTypes';

export interface IAiService {
  analyzeMeal(base64: string): Promise<MealAnalysis>;
  generateDailyAdvice(ctx: DailyAdviceContext): Promise<DailyAdviceResult>;
  generateMealSuggestion(ctx: MealSuggestionContext): Promise<MealSuggestionResult>;
  generateExerciseSuggestion(ctx: ExerciseSuggestionContext): Promise<ExerciseSuggestionResult>;
  generateInterrogationMessage(params: { missedDays: number; aiTone: AiTone }): Promise<string>;
  classifyMuscleGroups(exerciseName: string): Promise<string[]>;
  generateAvatarImage(base64Face: string, bodyDescription: string): Promise<AvatarImageResult>;
}
