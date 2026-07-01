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

export const getMealSuggestion = (rewardToken?: string): Promise<MealSuggestionResult> =>
  api.post('/ai/meal-suggestion', { rewardToken }).then(r => r.data);

export type ExerciseSuggestionItem = {
  name: string; sets: string; kcal_estimate: number; muscle_groups: string[]; reason: string;
};
export type ExerciseSuggestionResult = { summary: string; exercises: ExerciseSuggestionItem[]; error?: string };

export const getExerciseSuggestion = (goToGym: boolean, rewardToken?: string): Promise<ExerciseSuggestionResult> =>
  api.post('/ai/exercise-suggestion', { goToGym, rewardToken }).then(r => r.data);

export type AiUsageResult = {
  premium: boolean;
};

export const getAiUsage = (): Promise<AiUsageResult> =>
  api.get('/ai/usage').then(r => r.data);

export const issueRewardToken = (): Promise<{ tokenId: string }> =>
  api.post('/ai/reward-token').then(r => r.data);
