import api from './client';

export const verifyApplePurchase = (transactionId: string) =>
  api.post('/subscriptions/verify/apple', { transactionId }).then(r => r.data as { tier: string; expiresAt: string });

export const verifyGooglePurchase = (productId: string, purchaseToken: string) =>
  api.post('/subscriptions/verify/google', { productId, purchaseToken }).then(r => r.data as { tier: string; expiresAt: string });
