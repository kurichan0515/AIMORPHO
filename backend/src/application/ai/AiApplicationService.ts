import { randomUUID } from 'crypto';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { IGoalRepository } from '../../domain/user/IGoalRepository';
import { IStreakRepository } from '../../domain/user/IStreakRepository';
import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { IBodyLogRepository } from '../../domain/body-log/IBodyLogRepository';
import { IMealRepository } from '../../domain/meal/IMealRepository';
import { IAdviceRepository } from '../../domain/advice/IAdviceRepository';
import { IRewardTokenRepository } from '../../domain/reward/IRewardTokenRepository';
import { IAiService } from '../../domain/ai/IAiService';
import { FREE_AI_TONES } from '../../domain/usage/UsageLimits';
import { isPremium } from '../../domain/user/User';
import { calcUserTDEE } from '../../domain/health/RecoveryService';
import { Result, ok, err } from '../../domain/shared/Result';
import { UserId } from '../../domain/shared/types';
import { toJSTDate } from '../../infrastructure/dynamodb/client';

const REWARD_TOKEN_TTL_SEC = 4 * 60 * 60; // 4時間

const GOAL_ACHIEVE_MESSAGES: Record<string, (kg: number) => string> = {
  diet:     kg => `おめでとう！目標体重${kg}kgへの減量を達成しました！`,
  bulk:     kg => `おめでとう！目標体重${kg}kgへの増量を達成しました！`,
  maintain: kg => `おめでとう！${kg}kg維持を続けています！`,
};

export class AiApplicationService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly goalRepo: IGoalRepository,
    private readonly streakRepo: IStreakRepository,
    private readonly avatarRepo: IAvatarRepository,
    private readonly bodyLogRepo: IBodyLogRepository,
    private readonly mealRepo: IMealRepository,
    private readonly adviceRepo: IAdviceRepository,
    private readonly rewardTokenRepo: IRewardTokenRepository,
    private readonly aiSvc: IAiService,
  ) {}

  async issueRewardToken(userId: UserId): Promise<Result<{ tokenId: string }>> {
    const tokenId = randomUUID();
    const now = new Date().toISOString();
    // 非本番環境ではテスト広告へのSSVコールバックが来ないため、発行時点で検証済みにする
    const verified = process.env.NODE_ENV !== 'production';
    await this.rewardTokenRepo.create({
      tokenId,
      userId,
      createdAt: now,
      ttl: Math.floor(Date.now() / 1000) + REWARD_TOKEN_TTL_SEC,
      verified,
    });
    return ok({ tokenId });
  }

  async verifyRewardToken(userId: UserId, tokenId: string): Promise<boolean> {
    return this.rewardTokenRepo.findAndDeleteVerified(tokenId, userId);
  }

  async handleAdmobSsvCallback(tokenId: string): Promise<void> {
    await this.rewardTokenRepo.markVerified(tokenId);
  }

  async getDailyAdvice(userId: UserId): Promise<Result<unknown>> {
    const todayJST = toJSTDate(new Date().toISOString());
    const cached = await this.adviceRepo.getToday(userId, todayJST);
    if (cached) return ok(cached);

    const [user, goal, streak, avatar] = await Promise.all([
      this.userRepo.findById(userId),
      this.goalRepo.getGoal(userId),
      this.streakRepo.getStreak(userId),
      this.avatarRepo.get(userId),
    ]);
    if (!user) return err('User not found', 404);

    const [{ items: recentWeights }, recentMeals, recentExercises] = await Promise.all([
      this.bodyLogRepo.getWeightHistory(userId, '2020', '9999', 7),
      this.mealRepo.getRecent(userId, new Date(Date.now() - 9 * 86400000).toISOString()),
      this.bodyLogRepo.getRecentExercise(userId, new Date(Date.now() - 9 * 86400000).toISOString()),
    ]);

    const recentKcal = [0, 1, 2].map(i => {
      const d = toJSTDate(new Date(Date.now() - i * 86400000).toISOString());
      return recentMeals.filter(m => m.recordedAt.includes(d)).reduce((s, m) => s + m.kcal, 0);
    });

    const effectiveTone = isPremium(user) ? user.aiTone : FREE_AI_TONES[0];
    const advice = await this.aiSvc.generateDailyAdvice({
      age: user.age ?? 30, heightCm: user.heightCm ?? 165,
      currentWeight: recentWeights[0]?.weightKg ?? user.weightKg ?? 60,
      targetWeight: goal?.targetWeight ?? 60,
      goalMode: goal?.mode,
      lifestyle: user.lifestyle, aiTone: effectiveTone,
      hasGym: user.hasGym,
      currentDays: streak?.currentDays ?? 0,
      bodyState: avatar?.bodyState ?? 0,
      recentWeights: recentWeights.map(w => w.weightKg),
      recentKcal,
      recentExercise: recentExercises.slice(0, 3).map(e => e.exerciseName),
    });

    const item = { ...advice, generatedAt: new Date().toISOString() };
    await this.adviceRepo.save(userId, todayJST, item);
    return ok(item);
  }

  async handlePenaltyEvent(userId: UserId, answer?: string): Promise<Result<unknown>> {
    const streak = await this.streakRepo.getStreak(userId);
    if (!streak?.lastLoggedAt) return ok({ event: 'none' });

    const diffMs = Date.now() - new Date(streak.lastLoggedAt).getTime();
    const missedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (missedDays < 3) return ok({ event: 'none', missedDays });

    const avatar = await this.avatarRepo.get(userId);

    if (answer === 'YES') {
      const resetStreak = { ...streak, currentDays: 0 };
      await this.streakRepo.saveStreak(resetStreak);
      return ok({ event: 'penalty', result: 'lash', bodyStateChanged: false, missedDays });
    }

    if (answer === 'NO') {
      const newBodyState = Math.min((avatar?.bodyState ?? 0) + 1, 4);
      const now = new Date().toISOString();
      await Promise.all([
        this.avatarRepo.updateBodyState(userId, newBodyState, now),
        this.streakRepo.saveStreak({ ...streak, currentDays: 0 }),
      ]);
      return ok({ event: 'penalty', result: 'lash_and_degrade', newBodyState, missedDays });
    }

    const user = await this.userRepo.findById(userId);
    const question = await this.aiSvc.generateInterrogationMessage({ missedDays, aiTone: user?.aiTone ?? 'friendly' })
      .catch(() => `この${missedDays}日間、運動はしましたか？`);
    return ok({ event: 'interrogation', missedDays, question });
  }

  async getMealSuggestion(userId: UserId, rewardToken?: string): Promise<Result<unknown>> {
    const [user, goal] = await Promise.all([
      this.userRepo.findById(userId),
      this.goalRepo.getGoal(userId),
    ]);
    if (!user) return err('User not found', 404);

    if (!isPremium(user)) {
      if (!rewardToken) { return err('Reward token required', 403); }
      const valid = await this.verifyRewardToken(userId, rewardToken);
      if (!valid) { return err('Invalid or unverified reward token', 403); }
    }

    const todayJST = toJSTDate(new Date().toISOString());
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    const recentMeals = await this.mealRepo.getRecent(userId, since);
    const todayMeals = recentMeals.filter(m => toJSTDate(m.recordedAt) === todayJST);
    const todayKcal    = todayMeals.reduce((s, m) => s + m.kcal, 0);
    const todayProtein = todayMeals.reduce((s, m) => s + (m.proteinG ?? 0), 0);
    const todayFat     = todayMeals.reduce((s, m) => s + (m.fatG ?? 0), 0);
    const todayCarb    = todayMeals.reduce((s, m) => s + (m.carbG ?? 0), 0);
    const tdee = calcUserTDEE(user);
    const targetKcal = goal?.mode === 'diet' ? Math.round(tdee * 0.85) : goal?.mode === 'bulk' ? Math.round(tdee * 1.15) : tdee;

    const result = await this.aiSvc.generateMealSuggestion({
      age: user.age ?? 30, heightCm: user.heightCm ?? 165,
      currentWeight: user.weightKg ?? 60,
      targetWeight: goal?.targetWeight ?? user.weightKg ?? 60,
      goalMode: goal?.mode ?? 'maintain',
      lifestyle: user.lifestyle,
      aiTone: isPremium(user) ? user.aiTone : FREE_AI_TONES[0],
      todayKcal, todayProtein, todayFat, todayCarb, targetKcal,
    });
    return ok(result);
  }

  async getExerciseSuggestion(userId: UserId, goToGym: boolean, rewardToken?: string): Promise<Result<unknown>> {
    const [user, goal] = await Promise.all([
      this.userRepo.findById(userId),
      this.goalRepo.getGoal(userId),
    ]);
    if (!user) return err('User not found', 404);

    if (!isPremium(user)) {
      if (!rewardToken) { return err('Reward token required', 403); }
      const valid = await this.verifyRewardToken(userId, rewardToken);
      if (!valid) { return err('Invalid or unverified reward token', 403); }
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentExercise = await this.bodyLogRepo.getRecentExercise(userId, oneWeekAgo);
    const recentMuscleGroups = recentExercise.flatMap(e => e.muscleGroups ?? []);

    const result = await this.aiSvc.generateExerciseSuggestion({
      age: user.age ?? 30, heightCm: user.heightCm ?? 165,
      currentWeight: user.weightKg ?? 60,
      targetWeight: goal?.targetWeight ?? user.weightKg ?? 60,
      goalMode: goal?.mode ?? 'maintain',
      lifestyle: user.lifestyle,
      aiTone: isPremium(user) ? user.aiTone : FREE_AI_TONES[0],
      hasGym: user.hasGym ?? false,
      goToGym,
      recentMuscleGroups,
    });
    return ok(result);
  }

  async getAiUsage(userId: UserId): Promise<Result<unknown>> {
    const user = await this.userRepo.findById(userId);
    const premium = user ? isPremium(user) : false;
    return ok({ premium });
  }

  async getGoalMessage(userId: UserId): Promise<Result<unknown>> {
    const goal = await this.goalRepo.getGoal(userId);
    if (!goal?.achievedAt) return err('Goal not yet achieved', 400);
    const msgFn = GOAL_ACHIEVE_MESSAGES[goal.mode ?? 'diet'] ?? GOAL_ACHIEVE_MESSAGES.diet;
    const message = msgFn(goal.targetWeight);
    return ok({ message, achievedAt: goal.achievedAt });
  }
}
