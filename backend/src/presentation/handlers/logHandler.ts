import { LambdaEvent, error, parseBody, getUserId, toResponse } from '../http';
import { deps } from '../container';
import * as BodyLogUseCases from '../../application/body-log/BodyLogUseCases';

const logDeps = {
  userRepo: deps.userRepo,
  bodyLogRepo: deps.bodyLogRepo,
  avatarRepo: deps.avatarRepo,
  mealRepo: deps.mealRepo,
  badgeSvc: deps.badgeSvc,
};

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);
  const qs = event.queryStringParameters ?? {};

  try {
    if (path === '/logs/weight'   && httpMethod === 'POST') {
      const { weightKg, bodyFatPct } = body as { weightKg?: number; bodyFatPct?: number };
      if (!weightKg) return error('weightKg required');
      return toResponse(await BodyLogUseCases.recordWeight(logDeps, userId, weightKg, bodyFatPct));
    }
    if (path === '/logs/weight'   && httpMethod === 'GET') {
      return toResponse(await BodyLogUseCases.getWeightHistory(logDeps, userId, qs.from ?? '', qs.to ?? '', parseInt(qs.limit ?? '30', 10)));
    }
    if (path === '/logs/exercise' && httpMethod === 'POST') {
      const { exerciseName, durationMin, kcalBurned, completed, muscleGroups } = body as { exerciseName?: string; durationMin?: number; kcalBurned?: number; completed?: boolean; muscleGroups?: string[] };
      if (!exerciseName) return error('exerciseName required');
      return toResponse(await BodyLogUseCases.recordExercise(logDeps, userId, { exerciseName, durationMin, kcalBurned, completed, muscleGroups }));
    }
    if (path === '/logs/exercise' && httpMethod === 'GET') {
      return toResponse(await BodyLogUseCases.getExerciseHistory(logDeps, userId, qs.from ?? '', qs.to ?? '', parseInt(qs.limit ?? '30', 10)));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
