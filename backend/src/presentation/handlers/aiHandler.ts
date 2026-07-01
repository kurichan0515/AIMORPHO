import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { aiSvcApp } from '../container';
import { verifyAdmobSsvQuery } from '../../infrastructure/admob/AdmobSsvVerifier';

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/ai/usage'              && httpMethod === 'GET')  return fromResult(await aiSvcApp.getAiUsage(userId as never));
    if (path === '/ai/reward-token'       && httpMethod === 'POST') return fromResult(await aiSvcApp.issueRewardToken(userId as never));
    if (path === '/ai/daily-advice'       && httpMethod === 'GET')  return fromResult(await aiSvcApp.getDailyAdvice(userId as never));
    if (path === '/ai/penalty-event'      && httpMethod === 'POST') {
      const { answer } = body as { answer?: string };
      return fromResult(await aiSvcApp.handlePenaltyEvent(userId as never, answer));
    }
    if (path === '/ai/goal-message'       && httpMethod === 'GET')  return fromResult(await aiSvcApp.getGoalMessage(userId as never));
    if (path === '/ai/meal-suggestion'    && httpMethod === 'POST') {
      const { rewardToken } = body as { rewardToken?: string };
      return fromResult(await aiSvcApp.getMealSuggestion(userId as never, rewardToken));
    }
    if (path === '/ai/exercise-suggestion' && httpMethod === 'POST') {
      const { goToGym, rewardToken } = body as { goToGym?: boolean; rewardToken?: string };
      return fromResult(await aiSvcApp.getExerciseSuggestion(userId as never, goToGym ?? false, rewardToken));
    }

    // AdMob SSV コールバック（認証不要、Google から直接呼ばれる）
    if (path === '/webhooks/admob-reward' && httpMethod === 'GET') {
      const qs = event.queryStringParameters ?? {};
      const valid = await verifyAdmobSsvQuery(qs as Record<string, string>).catch(() => false);
      if (!valid) { return error('Invalid signature', 400); }
      const customData = qs.custom_data;
      if (customData) { await aiSvcApp.handleAdmobSsvCallback(customData).catch(() => {}); }
      return { statusCode: 200, body: 'OK' };
    }

    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
