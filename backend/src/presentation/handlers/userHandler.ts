import { LambdaEvent, ok, error, parseBody, getUserId, toResponse } from '../http';
import { deps } from '../container';
import * as UserUseCases from '../../application/user/UserUseCases';
import { UpdateProfileInput } from '../../domain/user/User';
import { GoalMode } from '../../domain/shared/types';

const userDeps = { userRepo: deps.userRepo };
const badgeDeps = { badgeRepo: deps.badgeRepo };

const ALLOWED_PROFILE_FIELDS: Array<keyof UpdateProfileInput> = [
  'displayName', 'age', 'heightCm', 'weightKg', 'bodyFatPct', 'lifestyle', 'aiTone', 'hasGym', 'bodyBalance',
];

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/users/me'        && httpMethod === 'GET')  return toResponse(await UserUseCases.getProfile(userDeps, userId));
    if (path === '/users/me'        && httpMethod === 'PUT')  {
      const input = Object.fromEntries(
        Object.entries(body).filter(([k]) => ALLOWED_PROFILE_FIELDS.includes(k as keyof UpdateProfileInput))
      ) as UpdateProfileInput;
      return toResponse(await UserUseCases.updateProfile(userDeps, userId, input));
    }
    if (path === '/users/me/goal'   && httpMethod === 'GET')  return toResponse(await UserUseCases.getGoal(userDeps, userId));
    if (path === '/users/me/goal'   && httpMethod === 'POST') {
      const { targetWeight, mode } = body as { targetWeight: number; mode: GoalMode };
      if (!targetWeight || !mode) return error('targetWeight and mode required');
      if (!['diet', 'maintain', 'bulk'].includes(mode)) return error('mode must be diet, maintain or bulk');
      return toResponse(await UserUseCases.upsertGoal(userDeps, userId, { targetWeight, mode }));
    }
    if (path === '/users/me/fcm-token' && httpMethod === 'PUT') {
      const { fcmToken } = body as { fcmToken?: string };
      if (!fcmToken) return error('fcmToken required');
      return toResponse(await UserUseCases.saveFcmToken(userDeps, userId, fcmToken));
    }
    if (path === '/users/me/streak' && httpMethod === 'GET')  return toResponse(await UserUseCases.getStreak(userDeps, userId));
    if (path === '/users/me/badges' && httpMethod === 'GET')  return toResponse(await UserUseCases.getBadges(badgeDeps, userId));
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
