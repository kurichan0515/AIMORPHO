import { IUserRepository } from '../../domain/user/IUserRepository';
import { UserId } from '../../domain/shared/types';
import { verifyAppleTransaction, decodeAppleWebhook, AppleWebhookPayload } from '../../infrastructure/iap/AppleIAPClient';
import { verifyGooglePurchase as verifyGooglePlay } from '../../infrastructure/iap/GooglePlayClient';

type Deps = { userRepo: IUserRepository };

export const verifyApplePurchase = async (
  deps: Deps,
  userId: UserId,
  transactionId: string
) => {
  const result = await verifyAppleTransaction(transactionId);
  if (!result.ok) {
    return { error: result.reason, statusCode: 400 } as const;
  }

  const user = await deps.userRepo.findById(userId);
  if (!user) return { error: 'User not found', statusCode: 404 } as const;

  if (user.subscriptionTransactionId === result.transactionId) {
    return { data: { tier: 'premium', expiresAt: result.expiresAt }, statusCode: 200 } as const;
  }

  await deps.userRepo.updateSubscriptionTier(userId, 'premium', {
    expiresAt: result.expiresAt,
    store: 'apple',
    productId: result.productId,
    transactionId: result.transactionId,
  });

  return { data: { tier: 'premium', expiresAt: result.expiresAt }, statusCode: 200 } as const;
};

export const verifyGooglePurchase = async (
  deps: Deps,
  userId: UserId,
  productId: string,
  purchaseToken: string
) => {
  const result = await verifyGooglePlay(productId, purchaseToken);
  if (!result.ok) {
    return { error: result.reason, statusCode: 400 } as const;
  }

  const user = await deps.userRepo.findById(userId);
  if (!user) return { error: 'User not found', statusCode: 404 } as const;

  if (user.subscriptionTransactionId === result.orderId) {
    return { data: { tier: 'premium', expiresAt: result.expiresAt }, statusCode: 200 } as const;
  }

  await deps.userRepo.updateSubscriptionTier(userId, 'premium', {
    expiresAt: result.expiresAt,
    store: 'google',
    productId: result.productId,
    transactionId: result.orderId,
  });

  return { data: { tier: 'premium', expiresAt: result.expiresAt }, statusCode: 200 } as const;
};

export const handleAppleWebhook = async (deps: Deps, payload: AppleWebhookPayload) => {
  const decoded = decodeAppleWebhook(payload);
  if (!decoded) return { error: 'invalid payload', statusCode: 400 } as const;

  const notificationType: string = decoded.notificationType;
  const appAccountToken: string | undefined = decoded.data?.signedTransactionInfo
    ? undefined
    : decoded.data?.appAccountToken;

  if (!['DID_RENEW', 'SUBSCRIBED', 'DID_CHANGE_RENEWAL_STATUS'].includes(notificationType)) {
    return { data: { received: true }, statusCode: 200 } as const;
  }

  const transactionJws: string = decoded.data?.signedTransactionInfo;
  if (!transactionJws || !appAccountToken) {
    return { data: { received: true }, statusCode: 200 } as const;
  }

  const userId = appAccountToken as UserId;
  await verifyApplePurchase(deps, userId, '');

  return { data: { received: true }, statusCode: 200 } as const;
};

export const handleGoogleWebhook = async (deps: Deps, message: { data: string }) => {
  const raw = Buffer.from(message.data, 'base64').toString('utf-8');
  const notification = JSON.parse(raw);

  const { subscriptionNotification } = notification;
  if (!subscriptionNotification) return { data: { received: true }, statusCode: 200 } as const;

  const { notificationType, purchaseToken, subscriptionId } = subscriptionNotification;

  if (![1, 2, 4].includes(notificationType)) {
    return { data: { received: true }, statusCode: 200 } as const;
  }

  const result = await verifyGooglePlay(subscriptionId, purchaseToken);
  if (!result.ok) return { data: { received: true }, statusCode: 200 } as const;

  return { data: { received: true }, statusCode: 200 } as const;
};
