import { IMealRepository } from '../../domain/meal/IMealRepository';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { IUsageRepository } from '../../domain/usage/IUsageRepository';
import { FREE_DAILY_LIMITS } from '../../domain/usage/UsageLimits';
import { MealLog } from '../../domain/meal/MealLog';
import { BadgeService } from '../../domain/badge/BadgeService';
import { analyzeMeal } from '../../infrastructure/gemini/GeminiClient';
import { getUploadUrl, getObjectBase64, publicUrl } from '../../infrastructure/s3/S3Client';
import { toJSTDate } from '../../infrastructure/dynamodb/client';
import { UserId } from '../../domain/shared/types';

type Deps = { mealRepo: IMealRepository; badgeSvc: BadgeService; userRepo: IUserRepository; usageRepo: IUsageRepository };

export const getMealUploadUrl = async (userId: UserId) => {
  const key = `meals/${userId}/${Date.now()}.jpg`;
  const uploadUrl = await getUploadUrl(key);
  return { data: { uploadUrl, s3Key: key }, statusCode: 200 } as const;
};

export const analyzeMealLog = async (deps: Deps, userId: UserId, s3Key: string) => {
  const user = await deps.userRepo.findById(userId);
  if (!user) return { error: 'User not found', statusCode: 404 } as const;

  if (user.subscriptionTier !== 'premium') {
    const todayJST = toJSTDate(new Date().toISOString());
    const allowed = await deps.usageRepo.tryIncrement(userId, todayJST, 'mealAnalysis', FREE_DAILY_LIMITS.mealAnalysis);
    if (!allowed) return { error: 'Daily usage limit reached', statusCode: 429 } as const;
  }

  const base64 = await getObjectBase64(s3Key);
  const result = await analyzeMeal(base64).catch(() => ({ menu_name: '', kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, confidence: 'low' as const, geminiRaw: '', error: 'analysis_failed' }));

  return { data: { ...result, s3Key, imageUrl: publicUrl(s3Key) }, statusCode: 200 } as const;
};

export const confirmMealLog = async (
  deps: Deps,
  userId: UserId,
  input: { s3Key: string; menuName: string; kcal: number; proteinG: number; fatG: number; carbG: number; confidence?: MealLog['confidence']; geminiRaw?: string }
) => {
  const now = new Date().toISOString();
  const log: MealLog = {
    userId,
    imageUrl: publicUrl(input.s3Key),
    menuName: input.menuName,
    kcal: input.kcal,
    proteinG: input.proteinG,
    fatG: input.fatG,
    carbG: input.carbG,
    confidence: input.confidence ?? 'high',
    geminiRaw: input.geminiRaw ?? '',
    recordedAt: now,
  };
  await deps.mealRepo.save(log);

  const count = await deps.mealRepo.count(userId);
  const newBadges = await deps.badgeSvc.checkCountBadges(userId, 'meal', count);

  return { data: { ...log, newBadges }, statusCode: 201 } as const;
};

export const saveMealManual = async (
  deps: Deps,
  userId: UserId,
  input: { menuName: string; kcal: number; proteinG: number; fatG: number; carbG: number }
) => {
  const now = new Date().toISOString();
  const log: MealLog = {
    userId,
    imageUrl: '',
    menuName: input.menuName,
    kcal: input.kcal,
    proteinG: input.proteinG,
    fatG: input.fatG,
    carbG: input.carbG,
    confidence: 'high',
    geminiRaw: '',
    recordedAt: now,
  };
  await deps.mealRepo.save(log);

  const count = await deps.mealRepo.count(userId);
  const newBadges = await deps.badgeSvc.checkCountBadges(userId, 'meal', count);

  return { data: { ...input, recordedAt: now, newBadges }, statusCode: 201 } as const;
};

export const getMealHistory = async (deps: Deps, userId: UserId, from: string, to: string, limit: number) => {
  const items = await deps.mealRepo.getHistory(userId, from || '1970', to || '9999', limit);
  return { data: items, statusCode: 200 } as const;
};
