import { IAiService } from '../../domain/ai/IAiService';
import { AiTone } from '../../domain/shared/types';
import type {
  MealAnalysis, DailyAdviceContext, DailyAdviceResult,
  MealSuggestionContext, MealSuggestionResult,
  ExerciseSuggestionContext, ExerciseSuggestionResult,
  AvatarImageResult,
} from '../../domain/ai/AiTypes';
import {
  analyzeMeal,
  generateDailyAdvice,
  generateMealSuggestion,
  generateExerciseSuggestion,
  generateInterrogationMessage,
  classifyMuscleGroups,
  generateAvatarImage,
} from './GeminiClient';

export class AiService implements IAiService {
  analyzeMeal(base64: string): Promise<MealAnalysis> {
    return analyzeMeal(base64);
  }

  generateDailyAdvice(ctx: DailyAdviceContext): Promise<DailyAdviceResult> {
    return generateDailyAdvice(ctx);
  }

  generateMealSuggestion(ctx: MealSuggestionContext): Promise<MealSuggestionResult> {
    return generateMealSuggestion(ctx);
  }

  generateExerciseSuggestion(ctx: ExerciseSuggestionContext): Promise<ExerciseSuggestionResult> {
    return generateExerciseSuggestion(ctx);
  }

  generateInterrogationMessage(params: { missedDays: number; aiTone: AiTone }): Promise<string> {
    return generateInterrogationMessage(params);
  }

  classifyMuscleGroups(exerciseName: string): Promise<string[]> {
    return classifyMuscleGroups(exerciseName);
  }

  generateAvatarImage(base64Face: string, bodyDescription: string): Promise<AvatarImageResult> {
    return generateAvatarImage(base64Face, bodyDescription);
  }
}
