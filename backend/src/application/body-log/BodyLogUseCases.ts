import { IUserRepository } from '../../domain/user/IUserRepository';
import { emptyStreak, updateStreak } from '../../domain/user/Streak';
import { IBodyLogRepository } from '../../domain/body-log/IBodyLogRepository';
import { WeightLog } from '../../domain/body-log/WeightLog';
import { ExerciseLog } from '../../domain/body-log/ExerciseLog';
import { BadgeService } from '../../domain/badge/BadgeService';
import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { IMealRepository } from '../../domain/meal/IMealRepository';
import { checkRecoveryCondition, calcUserTDEE } from '../../domain/health/RecoveryService';
import { UserId } from '../../domain/shared/types';
import { toJSTDate } from '../../infrastructure/dynamodb/client';

type Deps = {
  userRepo: IUserRepository;
  bodyLogRepo: IBodyLogRepository;
  avatarRepo: IAvatarRepository;
  mealRepo: IMealRepository;
  badgeSvc: BadgeService;
};

export const recordWeight = async (deps: Deps, userId: UserId, weightKg: number) => {
  const now = new Date().toISOString();
  const log: WeightLog = { userId, weightKg, recordedAt: now };
  await deps.bodyLogRepo.saveWeight(log);

  const currentStreak = await deps.userRepo.getStreak(userId) ?? emptyStreak(userId);
  const newStreak = updateStreak(currentStreak, now, toJSTDate);
  await deps.userRepo.saveStreak(newStreak);

  await checkAndHandleGoalAchievement(deps, userId, weightKg);

  const newBadges = [];
  const firstBadge = await deps.badgeSvc.award(userId, 'weight_first');
  if (firstBadge) newBadges.push(firstBadge);
  const streakBadges = await deps.badgeSvc.checkStreakBadges(userId, newStreak.currentDays);
  newBadges.push(...streakBadges);

  return { data: { weightKg, recordedAt: now, newBadges }, statusCode: 201 } as const;
};

export const getWeightHistory = async (deps: Deps, userId: UserId, from: string, to: string, limit: number) => {
  const items = await deps.bodyLogRepo.getWeightHistory(userId, from || '1970', to || '9999', limit);
  return { data: items, statusCode: 200 } as const;
};

export const recordExercise = async (deps: Deps, userId: UserId, input: {
  exerciseName: string; durationMin?: number; kcalBurned?: number; completed?: boolean; muscleGroups?: string[];
}) => {
  const now = new Date().toISOString();
  const log: ExerciseLog = {
    userId,
    exerciseName: input.exerciseName,
    durationMin: input.durationMin ?? 0,
    kcalBurned: input.kcalBurned ?? 0,
    completed: input.completed ?? true,
    muscleGroups: input.muscleGroups,
    recordedAt: now,
  };
  await deps.bodyLogRepo.saveExercise(log);

  const count = await deps.bodyLogRepo.countExercise(userId);
  const newBadges = await deps.badgeSvc.checkCountBadges(userId, 'exercise', count);

  let recovered = false;
  if (log.completed) {
    recovered = await checkAndHandleRecovery(deps, userId);
    if (recovered) {
      const rb = await deps.badgeSvc.award(userId, 'recovery');
      if (rb) newBadges.push(rb);
    }
  }

  return { data: { ...log, newBadges, recovered }, statusCode: 201 } as const;
};

export const getExerciseHistory = async (deps: Deps, userId: UserId, from: string, to: string, limit: number) => {
  const items = await deps.bodyLogRepo.getExerciseHistory(userId, from || '1970', to || '9999', limit);
  return { data: items, statusCode: 200 } as const;
};

async function checkAndHandleGoalAchievement(deps: Deps, userId: UserId, currentWeight: number): Promise<void> {
  const goal = await deps.userRepo.getGoal(userId);
  if (!goal || goal.achievedAt) return;
  const achieved =
    (goal.mode === 'diet'     && currentWeight <= goal.targetWeight) ||
    (goal.mode === 'bulk'     && currentWeight >= goal.targetWeight) ||
    (goal.mode === 'maintain' && Math.abs(currentWeight - goal.targetWeight) <= 1.0);

  if (achieved) {
    const now = new Date().toISOString();
    await deps.userRepo.achieveGoal(userId, now);
    const avatar = await deps.avatarRepo.get(userId);
    if (avatar) await deps.avatarRepo.updateBodyState(userId, 0, now);
    await deps.badgeSvc.award(userId, 'goal_achieve');
  }
}

async function checkAndHandleRecovery(deps: Deps, userId: UserId): Promise<boolean> {
  const [user, avatar, streak] = await Promise.all([
    deps.userRepo.findById(userId),
    deps.avatarRepo.get(userId),
    deps.userRepo.getStreak(userId),
  ]);
  if (!avatar || avatar.bodyState === 0 || !user) return false;

  const tdee = calcUserTDEE(user);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const [recentExercise, recentMeals] = await Promise.all([
    deps.bodyLogRepo.getRecentExercise(userId, threeDaysAgo),
    deps.mealRepo.getRecent(userId, threeDaysAgo),
  ]);

  const recentKcal3days = [0, 1, 2].map(i => {
    const d = toJSTDate(new Date(Date.now() - i * 86400000).toISOString());
    return recentMeals.filter(m => m.recordedAt.includes(d)).reduce((s, m) => s + m.kcal, 0);
  });

  const goal = await deps.userRepo.getGoal(userId);
  const canRecover = checkRecoveryCondition({
    streakDays: streak?.currentDays ?? 0,
    recentExercise,
    recentKcal3days,
    tdee,
    goalMode: goal?.mode,
  });

  if (canRecover && avatar.bodyState > 0) {
    const now = new Date().toISOString();
    await deps.avatarRepo.updateBodyState(userId, avatar.bodyState - 1, now);
    return true;
  }
  return false;
}
