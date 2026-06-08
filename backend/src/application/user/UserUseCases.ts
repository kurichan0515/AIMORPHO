import { IUserRepository } from '../../domain/user/IUserRepository';
import { UpdateProfileInput } from '../../domain/user/User';
import { Goal } from '../../domain/user/Goal';
import { emptyStreak } from '../../domain/user/Streak';
import { IBadgeRepository } from '../../domain/badge/IBadgeRepository';
import { UserId, GoalMode } from '../../domain/shared/types';

type UserDeps = { userRepo: IUserRepository };
type BadgeDeps = { badgeRepo: IBadgeRepository };

export const getProfile = async ({ userRepo }: UserDeps, userId: UserId) => {
  const user = await userRepo.findById(userId);
  if (!user) return { error: 'User not found', statusCode: 404 } as const;
  const { passwordHash, ...profile } = user;
  return { data: profile, statusCode: 200 } as const;
};

export const updateProfile = async ({ userRepo }: UserDeps, userId: UserId, input: UpdateProfileInput) => {
  if (!Object.keys(input).length) return { error: 'No valid fields to update', statusCode: 400 } as const;
  const updated = await userRepo.updateProfile(userId, input);
  const { passwordHash, ...profile } = updated;
  return { data: profile, statusCode: 200 } as const;
};

export const getGoal = async ({ userRepo }: UserDeps, userId: UserId) => {
  const goal = await userRepo.getGoal(userId);
  if (!goal) return { error: 'No active goal', statusCode: 404 } as const;
  return { data: goal, statusCode: 200 } as const;
};

export const upsertGoal = async (
  { userRepo }: UserDeps,
  userId: UserId,
  { targetWeight, mode }: { targetWeight: number; mode: GoalMode }
) => {
  const goal: Goal = { userId, targetWeight, mode, startedAt: new Date().toISOString() };
  await userRepo.upsertGoal(goal);
  return { data: goal, statusCode: 201 } as const;
};

export const getStreak = async ({ userRepo }: UserDeps, userId: UserId) => {
  const streak = await userRepo.getStreak(userId) ?? emptyStreak(userId);
  return { data: streak, statusCode: 200 } as const;
};

export const getBadges = async ({ badgeRepo }: BadgeDeps, userId: UserId) => {
  const badges = await badgeRepo.listByUser(userId);
  return { data: badges, statusCode: 200 } as const;
};
