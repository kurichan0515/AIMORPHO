import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { mealSvc } from '../container';
import { MealLog } from '../../domain/meal/MealLog';

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);
  const qs = event.queryStringParameters ?? {};

  try {
    if (path === '/logs/meal/upload-url' && httpMethod === 'GET')  return fromResult(await mealSvc.getMealUploadUrl(userId as never));
    if (path === '/logs/meal/manual'     && httpMethod === 'POST') {
      const { menuName, kcal, proteinG, fatG, carbG } = body as { menuName?: string; kcal?: number; proteinG?: number; fatG?: number; carbG?: number };
      if (kcal === undefined) return error('kcal required');
      return fromResult(await mealSvc.saveMealManual(userId as never, { menuName: menuName ?? '手動入力', kcal, proteinG: proteinG ?? 0, fatG: fatG ?? 0, carbG: carbG ?? 0 }), 201);
    }
    if (path === '/logs/meal'            && httpMethod === 'POST') {
      const { s3Key } = body as { s3Key?: string };
      if (!s3Key) return error('s3Key required');
      return fromResult(await mealSvc.analyzeMeal(userId as never, s3Key));
    }
    if (path === '/logs/meal/confirm'    && httpMethod === 'POST') {
      const { s3Key, menuName, kcal, proteinG, fatG, carbG, confidence, geminiRaw } = body as {
        s3Key?: string; menuName?: string; kcal?: number; proteinG?: number; fatG?: number; carbG?: number;
        confidence?: MealLog['confidence']; geminiRaw?: string;
      };
      if (!s3Key || kcal === undefined) return error('s3Key and kcal required');
      if (!s3Key.startsWith(`meals/${userId}/`)) return error('Forbidden', 403);
      return fromResult(await mealSvc.confirmMeal(userId as never, {
        s3Key, menuName: menuName ?? '', kcal, proteinG: proteinG ?? 0, fatG: fatG ?? 0, carbG: carbG ?? 0, confidence, geminiRaw,
      }), 201);
    }
    if (path === '/logs/meal'            && httpMethod === 'DELETE') {
      return fromResult(await mealSvc.deleteMeal(userId as never, qs.at ?? ''));
    }
    if (path === '/logs/meal'            && httpMethod === 'GET')  {
      return fromResult(await mealSvc.getMealHistory(userId as never, qs.from ?? '', qs.to ?? '', parseInt(qs.limit ?? '30', 10), qs.cursor));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
