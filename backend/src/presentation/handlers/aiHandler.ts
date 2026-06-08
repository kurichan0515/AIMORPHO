import { LambdaEvent, error, parseBody, getUserId, toResponse } from '../http';
import { deps } from '../container';
import * as AiUseCases from '../../application/ai/AiUseCases';

const aiDeps = {
  userRepo: deps.userRepo,
  avatarRepo: deps.avatarRepo,
  bodyLogRepo: deps.bodyLogRepo,
  mealRepo: deps.mealRepo,
  adviceRepo: deps.adviceRepo,
};

export const handler = async (event: LambdaEvent) => {
  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/ai/daily-advice'  && httpMethod === 'GET')  return toResponse(await AiUseCases.getDailyAdvice(aiDeps, userId));
    if (path === '/ai/penalty-event' && httpMethod === 'POST') {
      const { answer } = body as { answer?: string };
      return toResponse(await AiUseCases.handlePenaltyEvent(aiDeps, userId, answer));
    }
    if (path === '/ai/goal-message'  && httpMethod === 'GET')  return toResponse(await AiUseCases.getGoalMessage(aiDeps, userId));
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
