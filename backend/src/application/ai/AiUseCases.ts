import { IUserRepository } from '../../domain/user/IUserRepository';
import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { IBodyLogRepository } from '../../domain/body-log/IBodyLogRepository';
import { IMealRepository } from '../../domain/meal/IMealRepository';
import { generateDailyAdvice, generateInterrogationMessage } from '../../infrastructure/gemini/GeminiClient';
import { AdviceRepository } from '../../infrastructure/dynamodb/AdviceRepository';
import { toJSTDate } from '../../infrastructure/dynamodb/client';
import { UserId } from '../../domain/shared/types';

type Deps = {
  userRepo: IUserRepository;
  avatarRepo: IAvatarRepository;
  bodyLogRepo: IBodyLogRepository;
  mealRepo: IMealRepository;
  adviceRepo: AdviceRepository;
};

export const getDailyAdvice = async (deps: Deps, userId: UserId) => {
  const todayJST = toJSTDate(new Date().toISOString());
  const cached = await deps.adviceRepo.getToday(userId, todayJST);
  if (cached) return { data: cached, statusCode: 200 } as const;

  const [user, goal, streak, avatar] = await Promise.all([
    deps.userRepo.findById(userId),
    deps.userRepo.getGoal(userId),
    deps.userRepo.getStreak(userId),
    deps.avatarRepo.get(userId),
  ]);
  if (!user) return { error: 'User not found', statusCode: 404 } as const;

  const [recentWeights, recentMeals, recentExercises] = await Promise.all([
    deps.bodyLogRepo.getWeightHistory(userId, '2020', '9999', 7),
    deps.mealRepo.getRecent(userId, new Date(Date.now() - 9 * 86400000).toISOString()),
    deps.bodyLogRepo.getRecentExercise(userId, new Date(Date.now() - 9 * 86400000).toISOString()),
  ]);

  const recentKcal = [0, 1, 2].map(i => {
    const d = toJSTDate(new Date(Date.now() - i * 86400000).toISOString());
    return recentMeals.filter(m => m.recordedAt.includes(d)).reduce((s, m) => s + m.kcal, 0);
  });

  const advice = await generateDailyAdvice({
    age: user.age ?? 30,
    heightCm: user.heightCm ?? 165,
    currentWeight: recentWeights[0]?.weightKg ?? user.weightKg ?? 60,
    targetWeight: goal?.targetWeight ?? 55,
    lifestyle: user.lifestyle,
    aiTone: user.aiTone,
    currentDays: streak?.currentDays ?? 0,
    bodyState: avatar?.bodyState ?? 0,
    recentWeights: recentWeights.map(w => w.weightKg),
    recentKcal,
    recentExercise: recentExercises.slice(0, 3).map(e => e.exerciseName),
  });

  const now = new Date().toISOString();
  const item = { ...advice, generatedAt: now };
  await deps.adviceRepo.save(userId, todayJST, item);
  return { data: item, statusCode: 200 } as const;
};

export const handlePenaltyEvent = async (
  deps: Deps,
  userId: UserId,
  answer?: string
) => {
  const streak = await deps.userRepo.getStreak(userId);
  if (!streak?.lastLoggedAt) return { data: { event: 'none' }, statusCode: 200 } as const;

  const diffMs = Date.now() - new Date(streak.lastLoggedAt).getTime();
  const missedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (missedDays < 3) return { data: { event: 'none', missedDays }, statusCode: 200 } as const;

  const avatar = await deps.avatarRepo.get(userId);

  if (answer === 'YES') {
    const resetStreak = { ...streak, currentDays: 0, missedDays: 0 };
    await deps.userRepo.saveStreak(resetStreak);
    return { data: { event: 'penalty', result: 'lash', bodyStateChanged: false, missedDays }, statusCode: 200 } as const;
  }

  if (answer === 'NO') {
    const newBodyState = Math.min((avatar?.bodyState ?? 0) + 1, 4);
    const now = new Date().toISOString();
    await Promise.all([
      deps.avatarRepo.updateBodyState(userId, newBodyState, now),
      deps.userRepo.saveStreak({ ...streak, currentDays: 0 }),
    ]);
    return { data: { event: 'penalty', result: 'lash_and_degrade', newBodyState, missedDays }, statusCode: 200 } as const;
  }

  const user = await deps.userRepo.findById(userId);
  const question = await generateInterrogationMessage({ missedDays, aiTone: user?.aiTone ?? 'friendly' })
    .catch(() => `この${missedDays}日間、運動はしましたか？`);
  return { data: { event: 'interrogation', missedDays, question }, statusCode: 200 } as const;
};

export const getGoalMessage = async (deps: Deps, userId: UserId) => {
  const goal = await deps.userRepo.getGoal(userId);
  if (!goal?.achievedAt) return { error: 'Goal not yet achieved', statusCode: 400 } as const;
  const message = `おめでとうございます！目標体重${goal.targetWeight}kgを達成しました！`;
  return { data: { message, achievedAt: goal.achievedAt }, statusCode: 200 } as const;
};
