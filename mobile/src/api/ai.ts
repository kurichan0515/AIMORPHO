import api from './client';

export const getDailyAdvice = () =>
  api.get('/ai/daily-advice').then(r => r.data);

export const sendPenaltyAnswer = (answer: 'YES' | 'NO') =>
  api.post('/ai/penalty-event', { answer }).then(r => r.data);

export const getGoalMessage = () =>
  api.get('/ai/goal-message').then(r => r.data);

export type MealSuggestionItem = {
  name: string; kcal: number; protein_g: number; fat_g: number; carb_g: number; reason: string;
};
export type MealSuggestionResult = { suggestion: string; meals: MealSuggestionItem[]; error?: string };

export const getMealSuggestion = (): Promise<MealSuggestionResult> =>
  api.post('/ai/meal-suggestion', {}).then(r => r.data);

export type ExerciseSuggestionItem = {
  name: string; sets: string; kcal_estimate: number; muscle_groups: string[]; reason: string;
};
export type ExerciseSuggestionResult = { summary: string; exercises: ExerciseSuggestionItem[]; error?: string };

export const getExerciseSuggestion = (goToGym: boolean): Promise<ExerciseSuggestionResult> =>
  api.post('/ai/exercise-suggestion', { goToGym }).then(r => r.data);
