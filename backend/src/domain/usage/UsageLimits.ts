export type UsageType = 'mealAnalysis' | 'mealSuggestion' | 'exerciseSuggestion';

export const FREE_DAILY_LIMITS: Record<UsageType, number> = {
  mealAnalysis: 2,
  mealSuggestion: 2,
  exerciseSuggestion: 1,
};
