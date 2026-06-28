import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { subscriptionSvc } from '../container';
import { AppleWebhookPayload } from '../../infrastructure/iap/AppleIAPClient';

export const handler = async (event: LambdaEvent) => {
  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/subscriptions/verify/apple' && httpMethod === 'POST') {
      const userId = getUserId(event);
      if (!userId) return error('Unauthorized', 401);
      const { transactionId } = body as { transactionId?: string };
      if (!transactionId) return error('transactionId required');
      return fromResult(await subscriptionSvc.verifyApplePurchase(userId as never, transactionId));
    }

    if (path === '/subscriptions/verify/google' && httpMethod === 'POST') {
      const userId = getUserId(event);
      if (!userId) return error('Unauthorized', 401);
      const { productId, purchaseToken } = body as { productId?: string; purchaseToken?: string };
      if (!productId || !purchaseToken) return error('productId and purchaseToken required');
      return fromResult(await subscriptionSvc.verifyGooglePurchase(userId as never, productId, purchaseToken));
    }

    if (path === '/subscriptions/webhook/apple' && httpMethod === 'POST') {
      const { signedPayload } = body as { signedPayload?: string };
      if (!signedPayload) return error('signedPayload required');
      return fromResult(await subscriptionSvc.handleAppleWebhook({ signedPayload } as AppleWebhookPayload));
    }

    if (path === '/subscriptions/webhook/google' && httpMethod === 'POST') {
      const { message } = body as { message?: { data: string } };
      if (!message?.data) return error('message.data required');
      return fromResult(await subscriptionSvc.handleGoogleWebhook(message));
    }

    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
