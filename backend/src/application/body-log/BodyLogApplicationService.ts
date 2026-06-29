import { IUserRepository } from '../../domain/user/IUserRepository';
import { IGoalRepository } from '../../domain/user/IGoalRepository';
import { IStreakRepository } from '../../domain/user/IStreakRepository';
import { IBodyLogRepository } from '../../domain/body-log/IBodyLogRepository';
import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { IMealRepository } from '../../domain/meal/IMealRepository';
import { IAiService } from '../../domain/ai/IAiService';
import { BadgeService } from '../../domain/badge/BadgeService';
import { WeightLog } from '../../domain/body-log/WeightLog';
import { ExerciseLog } from '../../domain/body-log/ExerciseLog';
import { emptyStreak, updateStreak, STREAK_MILESTONES } from '../../domain/user/Streak';
import { checkRecoveryCondition, calcUserTDEE } from '../../domain/health/RecoveryService';
import { Result, ok, err } from '../../domain/shared/Result';
import { UserId } from '../../domain/shared/types';
import { toJSTDate } from '../../infrastructure/dynamodb/client';

export class BodyLogApplicationService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly goalRepo: IGoalRepository,
    private readonly streakRepo: IStreakRepository,
    private readonly bodyLogRepo: IBodyLogRepository,
    private readonly avatarRepo: IAvatarRepository,
    private readonly mealRepo: IMealRepository,
    private readonly aiSvc: IAiService,
    private readonly badgeSvc: BadgeService,
  ) {}

  async recordWeight(userId: UserId, weightKg: number, bodyFatPct?: number): Promise<Result<unknown>> {
    const now = new Date().toISOString();
    const log: WeightLog = { userId, weightKg, bodyFatPct, recordedAt: now };
    await this.bodyLogRepo.saveWeight(log);

    const currentStreak = await this.streakRepo.getStreak(userId) ?? emptyStreak(userId);
    const { streak: newStreak, returnedAfterBreak } = updateStreak(currentStreak, now, toJSTDate);
    await this.streakRepo.saveStreak(newStreak);

    await this.#checkAndHandleGoalAchievement(userId, weightKg);

    const newBadges = [];
    const firstBadge = await this.badgeSvc.award(userId, 'weight_first');
    if (firstBadge) newBadges.push(firstBadge);
    const streakBadges = await this.badgeSvc.checkStreakBadges(userId, newStreak.currentDays);
    newBadges.push(...streakBadges);

    if (returnedAfterBreak) {
      const cb = await this.badgeSvc.award(userId, 'comeback');
      if (cb) newBadges.push(cb);
    }

    const streakMilestone = STREAK_MILESTONES.includes(newStreak.currentDays) ? newStreak.currentDays : null;

    return ok({ weightKg, bodyFatPct, recordedAt: now, newBadges, streakInfo: { currentDays: newStreak.currentDays, streakMilestone, returnedAfterBreak } });
  }

  async deleteWeight(userId: UserId, recordedAt: string): Promise<Result<unknown>> {
    if (!recordedAt) return err('recordedAt required', 400);
    await this.bodyLogRepo.deleteWeight(userId, recordedAt);
    return ok({ deleted: true });
  }

  async deleteExercise(userId: UserId, recordedAt: string): Promise<Result<unknown>> {
    if (!recordedAt) return err('recordedAt required', 400);
    await this.bodyLogRepo.deleteExercise(userId, recordedAt);
    return ok({ deleted: true });
  }

  async getWeightHistory(userId: UserId, from: string, to: string, limit: number, cursor?: string): Promise<Result<unknown>> {
    const { items, nextCursor } = await this.bodyLogRepo.getWeightHistory(userId, from || '1970', to || '9999', limit, cursor);
    return ok({ items, nextCursor });
  }

  async recordExercise(userId: UserId, input: {
    exerciseName: string; durationMin?: number; kcalBurned?: number; completed?: boolean; muscleGroups?: string[];
  }): Promise<Result<unknown>> {
    const now = new Date().toISOString();
    const muscleGroups = input.muscleGroups?.length
      ? input.muscleGroups
      : await this.aiSvc.classifyMuscleGroups(input.exerciseName).catch(() => []);
    const log: ExerciseLog = {
      userId,
      exerciseName: input.exerciseName,
      durationMin: input.durationMin ?? 0,
      kcalBurned: input.kcalBurned ?? 0,
      completed: input.completed ?? true,
      muscleGroups,
      recordedAt: now,
    };
    await this.bodyLogRepo.saveExercise(log);

    // ストリーク更新（食事・体重と同じく運動も継続カウント）
    const currentStreak = await this.streakRepo.getStreak(userId) ?? emptyStreak(userId);
    const { streak: newStreak, returnedAfterBreak } = updateStreak(currentStreak, now, toJSTDate);
    await this.streakRepo.saveStreak(newStreak);

    const count = await this.bodyLogRepo.countExercise(userId);
    const newBadges = await this.badgeSvc.checkCountBadges(userId, 'exercise', count);

    const firstBadge = await this.badgeSvc.award(userId, 'exercise_first');
    if (firstBadge) newBadges.push(firstBadge);

    const streakBadges = await this.badgeSvc.checkStreakBadges(userId, newStreak.currentDays);
    newBadges.push(...streakBadges);

    if (returnedAfterBreak) {
      const cb = await this.badgeSvc.award(userId, 'comeback');
      if (cb) newBadges.push(cb);
    }

    let recovered = false;
    if (log.completed) {
      recovered = await this.#checkAndHandleRecovery(userId);
      if (recovered) {
        const rb = await this.badgeSvc.award(userId, 'recovery');
        if (rb) newBadges.push(rb);
      }
    }

    const streakMilestone = STREAK_MILESTONES.includes(newStreak.currentDays) ? newStreak.currentDays : null;

    return ok({ ...log, newBadges, recovered, streakInfo: { currentDays: newStreak.currentDays, streakMilestone, returnedAfterBreak } });
  }

  async getExerciseHistory(userId: UserId, from: string, to: string, limit: number, cursor?: string): Promise<Result<unknown>> {
    const { items, nextCursor } = await this.bodyLogRepo.getExerciseHistory(userId, from || '1970', to || '9999', limit, cursor);
    return ok({ items, nextCursor });
  }

  async #checkAndHandleGoalAchievement(userId: UserId, currentWeight: number): Promise<void> {
    const goal = await this.goalRepo.getGoal(userId);
    if (!goal || goal.achievedAt) return;
    const achieved =
      (goal.mode === 'diet'     && currentWeight <= goal.targetWeight) ||
      (goal.mode === 'bulk'     && currentWeight >= goal.targetWeight) ||
      (goal.mode === 'maintain' && Math.abs(currentWeight - goal.targetWeight) <= 1.0);

    if (achieved) {
      const now = new Date().toISOString();
      await this.goalRepo.achieveGoal(userId, now);
      const avatar = await this.avatarRepo.get(userId);
      if (avatar) await this.avatarRepo.updateBodyState(userId, 0, now);
      await this.badgeSvc.award(userId, 'goal_achieve');
    }
  }

  async #checkAndHandleRecovery(userId: UserId): Promise<boolean> {
    const [user, avatar, streak] = await Promise.all([
      this.userRepo.findById(userId),
      this.avatarRepo.get(userId),
      this.streakRepo.getStreak(userId),
    ]);
    if (!avatar || avatar.bodyState === 0 || !user) return false;

    const tdee = calcUserTDEE(user);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const [recentExercise, recentMeals] = await Promise.all([
      this.bodyLogRepo.getRecentExercise(userId, threeDaysAgo),
      this.mealRepo.getRecent(userId, threeDaysAgo),
    ]);

    const recentKcal3days = [0, 1, 2].map(i => {
      const d = toJSTDate(new Date(Date.now() - i * 86400000).toISOString());
      return recentMeals.filter(m => m.recordedAt.includes(d)).reduce((s, m) => s + m.kcal, 0);
    });

    const goal = await this.goalRepo.getGoal(userId);
    const canRecover = checkRecoveryCondition({
      streakDays: streak?.currentDays ?? 0,
      recentExercise,
      recentKcal3days,
      tdee,
      goalMode: goal?.mode,
    });

    if (canRecover && avatar.bodyState > 0) {
      const now = new Date().toISOString();
      await this.avatarRepo.updateBodyState(userId, avatar.bodyState - 1, now);
      return true;
    }
    return false;
  }
}
