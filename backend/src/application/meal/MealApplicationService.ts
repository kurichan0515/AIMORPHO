import { IMealRepository } from '../../domain/meal/IMealRepository';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { IUsageRepository } from '../../domain/usage/IUsageRepository';
import { IStreakRepository } from '../../domain/user/IStreakRepository';
import { IStorageService } from '../../domain/storage/IStorageService';
import { IAiService } from '../../domain/ai/IAiService';
import { FREE_DAILY_LIMITS, FREE_MONTHLY_MEAL_LIMIT } from '../../domain/usage/UsageLimits';
import { isPremium } from '../../domain/user/User';
import { MealLog } from '../../domain/meal/MealLog';
import { BadgeService } from '../../domain/badge/BadgeService';
import { emptyStreak, updateStreak, STREAK_MILESTONES } from '../../domain/user/Streak';
import { Result, ok, err } from '../../domain/shared/Result';
import { UserId } from '../../domain/shared/types';
import { toJSTDate } from '../../infrastructure/dynamodb/client';

export class MealApplicationService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly mealRepo: IMealRepository,
    private readonly usageRepo: IUsageRepository,
    private readonly storageSvc: IStorageService,
    private readonly aiSvc: IAiService,
    private readonly badgeSvc: BadgeService,
    private readonly streakRepo: IStreakRepository,
  ) {}

  async getMealUploadUrl(userId: UserId): Promise<Result<{ uploadUrl: string; s3Key: string }>> {
    const key = `meals/${userId}/${Date.now()}.jpg`;
    const uploadUrl = await this.storageSvc.getMealUploadUrl(key);
    return ok({ uploadUrl, s3Key: key });
  }

  async analyzeMeal(userId: UserId, s3Key: string): Promise<Result<unknown>> {
    const user = await this.userRepo.findById(userId);
    if (!user) return err('User not found', 404);

    if (!isPremium(user)) {
      const todayJST = toJSTDate(new Date().toISOString());
      const allowed = await this.usageRepo.tryIncrement(userId, todayJST, 'mealAnalysis', FREE_DAILY_LIMITS.mealAnalysis);
      if (!allowed) return err('Daily usage limit reached', 429);
    }

    const base64 = await this.storageSvc.getObjectBase64(s3Key);
    const result = await this.aiSvc.analyzeMeal(base64)
      .catch(() => ({ menu_name: '', kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, confidence: 'low' as const, geminiRaw: '', error: 'analysis_failed' }));

    return ok({ ...result, s3Key, imageUrl: this.storageSvc.publicUrl(s3Key) });
  }

  async confirmMeal(userId: UserId, input: {
    s3Key: string; menuName: string; kcal: number;
    proteinG: number; fatG: number; carbG: number;
    confidence?: MealLog['confidence']; geminiRaw?: string;
  }): Promise<Result<unknown>> {
    const user = await this.userRepo.findById(userId);
    if (!user) return err('User not found', 404);
    if (!isPremium(user)) {
      const yearMonth = toJSTDate(new Date().toISOString()).slice(0, 7);
      const monthCount = await this.mealRepo.countMonth(userId, yearMonth);
      if (monthCount >= FREE_MONTHLY_MEAL_LIMIT) return err('Monthly meal limit reached', 429);
    }

    const now = new Date().toISOString();
    const log: MealLog = {
      userId,
      imageUrl: this.storageSvc.publicUrl(input.s3Key),
      menuName: input.menuName,
      kcal: input.kcal,
      proteinG: input.proteinG,
      fatG: input.fatG,
      carbG: input.carbG,
      confidence: input.confidence ?? 'high',
      geminiRaw: input.geminiRaw ?? '',
      recordedAt: now,
    };
    await this.mealRepo.save(log);

    const count = await this.mealRepo.count(userId);
    const newBadges = await this.badgeSvc.checkCountBadges(userId, 'meal', count);

    const firstBadge = await this.badgeSvc.award(userId, 'meal_first');
    if (firstBadge) newBadges.push(firstBadge);

    const currentStreak = await this.streakRepo.getStreak(userId) ?? emptyStreak(userId);
    const { streak: newStreak, returnedAfterBreak } = updateStreak(currentStreak, now, toJSTDate);
    await this.streakRepo.saveStreak(newStreak);

    const streakBadges = await this.badgeSvc.checkStreakBadges(userId, newStreak.currentDays);
    newBadges.push(...streakBadges);

    if (returnedAfterBreak) {
      const cb = await this.badgeSvc.award(userId, 'comeback');
      if (cb) newBadges.push(cb);
    }

    const streakMilestone = STREAK_MILESTONES.includes(newStreak.currentDays) ? newStreak.currentDays : null;

    return ok({ ...log, newBadges, streakInfo: { currentDays: newStreak.currentDays, streakMilestone, returnedAfterBreak } });
  }

  async saveMealManual(userId: UserId, input: {
    menuName: string; kcal: number; proteinG: number; fatG: number; carbG: number;
  }): Promise<Result<unknown>> {
    const user = await this.userRepo.findById(userId);
    if (!user) return err('User not found', 404);
    if (!isPremium(user)) {
      const yearMonth = toJSTDate(new Date().toISOString()).slice(0, 7);
      const monthCount = await this.mealRepo.countMonth(userId, yearMonth);
      if (monthCount >= FREE_MONTHLY_MEAL_LIMIT) return err('Monthly meal limit reached', 429);
    }

    const now = new Date().toISOString();
    const log: MealLog = {
      userId, imageUrl: '',
      menuName: input.menuName,
      kcal: input.kcal,
      proteinG: input.proteinG,
      fatG: input.fatG,
      carbG: input.carbG,
      confidence: 'high',
      geminiRaw: '',
      recordedAt: now,
    };
    await this.mealRepo.save(log);

    const count = await this.mealRepo.count(userId);
    const newBadges = await this.badgeSvc.checkCountBadges(userId, 'meal', count);

    const firstBadge = await this.badgeSvc.award(userId, 'meal_first');
    if (firstBadge) newBadges.push(firstBadge);

    const currentStreak = await this.streakRepo.getStreak(userId) ?? emptyStreak(userId);
    const { streak: newStreak, returnedAfterBreak } = updateStreak(currentStreak, now, toJSTDate);
    await this.streakRepo.saveStreak(newStreak);

    const streakBadges = await this.badgeSvc.checkStreakBadges(userId, newStreak.currentDays);
    newBadges.push(...streakBadges);

    if (returnedAfterBreak) {
      const cb = await this.badgeSvc.award(userId, 'comeback');
      if (cb) newBadges.push(cb);
    }

    const streakMilestone = STREAK_MILESTONES.includes(newStreak.currentDays) ? newStreak.currentDays : null;

    return ok({ ...input, recordedAt: now, newBadges, streakInfo: { currentDays: newStreak.currentDays, streakMilestone, returnedAfterBreak } });
  }

  async deleteMeal(userId: UserId, recordedAt: string): Promise<Result<unknown>> {
    if (!recordedAt) return err('recordedAt required', 400);
    await this.mealRepo.delete(userId, recordedAt);
    return ok({ deleted: true });
  }

  async getMealHistory(userId: UserId, from: string, to: string, limit: number, cursor?: string): Promise<Result<unknown>> {
    const { items, nextCursor } = await this.mealRepo.getHistory(userId, from || '1970', to || '9999', limit, cursor);
    return ok({ items, nextCursor });
  }
}
