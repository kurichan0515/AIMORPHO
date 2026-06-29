import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { userSvc } from '../container';
import { UpdateProfileInput } from '../../domain/user/User';
import { GoalMode } from '../../domain/shared/types';

const ALLOWED_PROFILE_FIELDS: Array<keyof UpdateProfileInput> = [
  'displayName', 'age', 'heightCm', 'weightKg', 'bodyFatPct', 'lifestyle', 'aiTone', 'hasGym', 'bodyBalance', 'notificationsEnabled',
];

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/users/me'           && httpMethod === 'GET')    return fromResult(await userSvc.getProfile(userId as never));
    if (path === '/users/me'           && httpMethod === 'PUT')    {
      const input = Object.fromEntries(
        Object.entries(body).filter(([k]) => ALLOWED_PROFILE_FIELDS.includes(k as keyof UpdateProfileInput))
      ) as UpdateProfileInput;
      return fromResult(await userSvc.updateProfile(userId as never, input));
    }
    if (path === '/users/me/goal'      && httpMethod === 'GET')    return fromResult(await userSvc.getGoal(userId as never));
    if (path === '/users/me/goal'      && httpMethod === 'POST')   {
      const { targetWeight, mode } = body as { targetWeight?: number; mode?: GoalMode };
      if (!targetWeight || !mode) return error('targetWeight and mode required');
      if (!['diet', 'maintain', 'bulk'].includes(mode)) return error('mode must be diet, maintain or bulk');
      return fromResult(await userSvc.upsertGoal(userId as never, targetWeight, mode), 201);
    }
    if (path === '/users/me/fcm-token' && httpMethod === 'PUT')    {
      const { fcmToken } = body as { fcmToken?: string };
      if (!fcmToken) return error('fcmToken required');
      return fromResult(await userSvc.saveFcmToken(userId as never, fcmToken));
    }
    if (path === '/users/me'           && httpMethod === 'DELETE') return fromResult(await userSvc.deleteAccount(userId as never));
    if (path === '/users/me/streak'    && httpMethod === 'GET')    return fromResult(await userSvc.getStreak(userId as never));
    if (path === '/users/me/badges'    && httpMethod === 'GET')    return fromResult(await userSvc.getBadges(userId as never));
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
