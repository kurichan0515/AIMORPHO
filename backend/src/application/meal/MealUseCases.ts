import { IMealRepository } from '../../domain/meal/IMealRepository';
import { MealLog } from '../../domain/meal/MealLog';
import { BadgeService } from '../../domain/badge/BadgeService';
import { analyzeMeal } from '../../infrastructure/gemini/GeminiClient';
import { getUploadUrl, getObjectBase64, publicUrl, BUCKET } from '../../infrastructure/s3/S3Client';
import { UserId } from '../../domain/shared/types';

type Deps = { mealRepo: IMealRepository; badgeSvc: BadgeService };

export const getMealUploadUrl = async (userId: UserId) => {
  const key = `meals/${userId}/${Date.now()}.jpg`;
  const uploadUrl = await getUploadUrl(key);
  return { data: { uploadUrl, s3Key: key }, statusCode: 200 } as const;
};

export const analyzeMealLog = async (deps: Deps, userId: UserId, s3Key: string) => {
  const base64 = await getObjectBase64(s3Key);
  const result = await analyzeMeal(base64).catch(() => ({ menu_name: '', kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, confidence: 'low' as const, geminiRaw: '', error: 'analysis_failed' }));

  const now = new Date().toISOString();
  const log: MealLog = {
    userId,
    imageUrl: publicUrl(s3Key),
    menuName: result.menu_name ?? '',
    kcal: result.kcal ?? 0,
    proteinG: result.protein_g ?? 0,
    fatG: result.fat_g ?? 0,
    carbG: result.carb_g ?? 0,
    confidence: result.confidence ?? 'low',
    geminiRaw: result.geminiRaw ?? '',
    recordedAt: now,
  };
  await deps.mealRepo.save(log);

  const count = await deps.mealRepo.count(userId);
  const newBadges = await deps.badgeSvc.checkCountBadges(userId, 'meal', count);

  return { data: { ...result, recordedAt: now, newBadges }, statusCode: 201 } as const;
};

export const getMealHistory = async (deps: Deps, userId: UserId, from: string, to: string, limit: number) => {
  const items = await deps.mealRepo.getHistory(userId, from || '1970', to || '9999', limit);
  return { data: items, statusCode: 200 } as const;
};
