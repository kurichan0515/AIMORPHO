import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { bodyLogSvc } from '../container';

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
      return fromResult(await bodyLogSvc.recordWeight(userId as never, weightKg, bodyFatPct), 201);
    }
    if (path === '/logs/weight'   && httpMethod === 'GET') {
      return fromResult(await bodyLogSvc.getWeightHistory(userId as never, qs.from ?? '', qs.to ?? '', parseInt(qs.limit ?? '30', 10), qs.cursor));
    }
    if (path === '/logs/weight'   && httpMethod === 'DELETE') {
      return fromResult(await bodyLogSvc.deleteWeight(userId as never, qs.at ?? ''));
    }
    if (path === '/logs/exercise' && httpMethod === 'POST') {
      const { exerciseName, durationMin, kcalBurned, completed, muscleGroups } = body as {
        exerciseName?: string; durationMin?: number; kcalBurned?: number; completed?: boolean; muscleGroups?: string[];
      };
      if (!exerciseName) return error('exerciseName required');
      return fromResult(await bodyLogSvc.recordExercise(userId as never, { exerciseName, durationMin, kcalBurned, completed, muscleGroups }), 201);
    }
    if (path === '/logs/exercise' && httpMethod === 'GET') {
      return fromResult(await bodyLogSvc.getExerciseHistory(userId as never, qs.from ?? '', qs.to ?? '', parseInt(qs.limit ?? '30', 10), qs.cursor));
    }
    if (path === '/logs/exercise' && httpMethod === 'DELETE') {
      return fromResult(await bodyLogSvc.deleteExercise(userId as never, qs.at ?? ''));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
