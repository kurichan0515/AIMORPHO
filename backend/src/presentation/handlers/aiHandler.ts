import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { aiSvcApp } from '../container';

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/ai/usage'              && httpMethod === 'GET')  return fromResult(await aiSvcApp.getAiUsage(userId as never));
    if (path === '/ai/daily-advice'       && httpMethod === 'GET')  return fromResult(await aiSvcApp.getDailyAdvice(userId as never));
    if (path === '/ai/penalty-event'      && httpMethod === 'POST') {
      const { answer } = body as { answer?: string };
      return fromResult(await aiSvcApp.handlePenaltyEvent(userId as never, answer));
    }
    if (path === '/ai/goal-message'       && httpMethod === 'GET')  return fromResult(await aiSvcApp.getGoalMessage(userId as never));
    if (path === '/ai/meal-suggestion'    && httpMethod === 'POST') return fromResult(await aiSvcApp.getMealSuggestion(userId as never));
    if (path === '/ai/exercise-suggestion' && httpMethod === 'POST') {
      const { goToGym } = body as { goToGym?: boolean };
      return fromResult(await aiSvcApp.getExerciseSuggestion(userId as never, goToGym ?? false));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
