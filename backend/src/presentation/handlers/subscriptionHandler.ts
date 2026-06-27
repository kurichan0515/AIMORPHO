import { LambdaEvent, error, parseBody, getUserId, toResponse } from '../http';
import { deps } from '../container';
import * as SubscriptionUseCases from '../../application/subscription/SubscriptionUseCases';

const subDeps = { userRepo: deps.userRepo };

export const handler = async (event: LambdaEvent) => {
  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/subscriptions/verify/apple' && httpMethod === 'POST') {
      const userId = getUserId(event);
      if (!userId) return error('Unauthorized', 401);
      const { transactionId } = body as { transactionId?: string };
      if (!transactionId) return error('transactionId required');
      return toResponse(await SubscriptionUseCases.verifyApplePurchase(subDeps, userId, transactionId));
    }

    if (path === '/subscriptions/verify/google' && httpMethod === 'POST') {
      const userId = getUserId(event);
      if (!userId) return error('Unauthorized', 401);
      const { productId, purchaseToken } = body as { productId?: string; purchaseToken?: string };
      if (!productId || !purchaseToken) return error('productId and purchaseToken required');
      return toResponse(await SubscriptionUseCases.verifyGooglePurchase(subDeps, userId, productId, purchaseToken));
    }

    if (path === '/subscriptions/webhook/apple' && httpMethod === 'POST') {
      const { signedPayload } = body as { signedPayload?: string };
      if (!signedPayload) return error('signedPayload required');
      return toResponse(await SubscriptionUseCases.handleAppleWebhook(subDeps, { signedPayload }));
    }

    if (path === '/subscriptions/webhook/google' && httpMethod === 'POST') {
      const { message } = body as { message?: { data: string } };
      if (!message?.data) return error('message.data required');
      return toResponse(await SubscriptionUseCases.handleGoogleWebhook(subDeps, message));
    }

    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
