import api from './client';

export type HistoryPage<T> = { items: T[]; nextCursor: string | null };

export const recordWeight = (weightKg: number, bodyFatPct?: number) =>
  api.post('/logs/weight', { weightKg, bodyFatPct }).then(r => r.data);

export const getWeightHistory = (params?: { from?: string; to?: string; limit?: number; cursor?: string }): Promise<HistoryPage<any>> =>
  api.get('/logs/weight', { params }).then(r => r.data);

export const getMealUploadUrl = () =>
  api.get('/logs/meal/upload-url').then(r => r.data as { uploadUrl: string; s3Key: string });

export const analyzeMeal = (s3Key: string) =>
  api.post('/logs/meal', { s3Key }).then(r => r.data);

export const confirmMeal = (input: {
  s3Key: string;
  menuName: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  confidence?: 'high' | 'medium' | 'low';
  geminiRaw?: string;
}) => api.post('/logs/meal/confirm', input).then(r => r.data);

export const getMealHistory = (params?: { from?: string; to?: string; limit?: number; cursor?: string }): Promise<HistoryPage<any>> =>
  api.get('/logs/meal', { params }).then(r => r.data);

export const recordExercise = (body: {
  exerciseName: string;
  durationMin?: number;
  kcalBurned?: number;
  completed?: boolean;
  muscleGroups?: string[];
}) => api.post('/logs/exercise', body).then(r => r.data);

export const getExerciseHistory = (params?: { from?: string; to?: string; limit?: number; cursor?: string }): Promise<HistoryPage<any>> =>
  api.get('/logs/exercise', { params }).then(r => r.data);

export const uploadImageToS3 = async (uploadUrl: string, imageUri: string): Promise<void> => {
  const res = await fetch(imageUri);
  const blob = await res.blob();
  await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
};
