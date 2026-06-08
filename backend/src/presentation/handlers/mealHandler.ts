import { LambdaEvent, error, parseBody, getUserId, toResponse } from '../http';
import { deps } from '../container';
import * as MealUseCases from '../../application/meal/MealUseCases';

const mealDeps = { mealRepo: deps.mealRepo, badgeSvc: deps.badgeSvc };

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);
  const qs = event.queryStringParameters ?? {};

  try {
    if (path === '/logs/meal/upload-url' && httpMethod === 'GET')  return toResponse(await MealUseCases.getMealUploadUrl(userId));
    if (path === '/logs/meal'            && httpMethod === 'POST') {
      const { s3Key } = body as { s3Key?: string };
      if (!s3Key) return error('s3Key required');
      return toResponse(await MealUseCases.analyzeMealLog(mealDeps, userId, s3Key));
    }
    if (path === '/logs/meal'            && httpMethod === 'GET')  {
      return toResponse(await MealUseCases.getMealHistory(mealDeps, userId, qs.from ?? '', qs.to ?? '', parseInt(qs.limit ?? '30', 10)));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
