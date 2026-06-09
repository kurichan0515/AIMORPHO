import api from './client';

export const recordWeight = (weightKg: number) =>
  api.post('/logs/weight', { weightKg }).then(r => r.data);

export const getWeightHistory = (params?: { from?: string; to?: string; limit?: number }) =>
  api.get('/logs/weight', { params }).then(r => r.data);

export const getMealUploadUrl = () =>
  api.get('/logs/meal/upload-url').then(r => r.data as { uploadUrl: string; s3Key: string });

export const analyzeMeal = (s3Key: string) =>
  api.post('/logs/meal', { s3Key }).then(r => r.data);

export const getMealHistory = (params?: { from?: string; to?: string; limit?: number }) =>
  api.get('/logs/meal', { params }).then(r => r.data);

export const recordExercise = (body: {
  exerciseName: string;
  durationMin?: number;
  kcalBurned?: number;
  completed?: boolean;
  muscleGroups?: string[];
}) => api.post('/logs/exercise', body).then(r => r.data);

export const getExerciseHistory = (params?: { from?: string; to?: string; limit?: number }) =>
  api.get('/logs/exercise', { params }).then(r => r.data);

export const uploadImageToS3 = async (uploadUrl: string, imageUri: string): Promise<void> => {
  const res = await fetch(imageUri);
  const blob = await res.blob();
  await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
};
