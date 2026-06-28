import { IUserRepository } from '../../domain/user/IUserRepository';
import { Result, ok, err } from '../../domain/shared/Result';
import { UserId } from '../../domain/shared/types';
import { verifyAppleTransaction, decodeAppleWebhook, AppleWebhookPayload } from '../../infrastructure/iap/AppleIAPClient';
import { verifyGooglePurchase as verifyGooglePlay } from '../../infrastructure/iap/GooglePlayClient';

const IAP_MOCK = process.env.IAP_MOCK === 'true';
const MOCK_EXPIRES_AT = () => new Date(Date.now() + 365 * 86400000).toISOString();

export class SubscriptionApplicationService {
  constructor(private readonly userRepo: IUserRepository) {}

  async verifyApplePurchase(userId: UserId, transactionId: string): Promise<Result<{ tier: string; expiresAt: string }>> {
    if (IAP_MOCK) {
      const expiresAt = MOCK_EXPIRES_AT();
      await this.userRepo.updateSubscriptionTier(userId, 'premium', {
        expiresAt, store: 'apple',
        productId: 'com.aimorpho.premium.monthly',
        transactionId: `mock-apple-${transactionId}`,
      });
      return ok({ tier: 'premium', expiresAt });
    }

    const result = await verifyAppleTransaction(transactionId);
    if (!result.ok) return err(result.reason, 400);

    const user = await this.userRepo.findById(userId);
    if (!user) return err('User not found', 404);

    if (user.subscriptionTransactionId === result.transactionId) {
      return ok({ tier: 'premium', expiresAt: result.expiresAt });
    }

    await this.userRepo.updateSubscriptionTier(userId, 'premium', {
      expiresAt: result.expiresAt, store: 'apple',
      productId: result.productId, transactionId: result.transactionId,
    });
    return ok({ tier: 'premium', expiresAt: result.expiresAt });
  }

  async verifyGooglePurchase(userId: UserId, productId: string, purchaseToken: string): Promise<Result<{ tier: string; expiresAt: string }>> {
    if (IAP_MOCK) {
      const expiresAt = MOCK_EXPIRES_AT();
      await this.userRepo.updateSubscriptionTier(userId, 'premium', {
        expiresAt, store: 'google', productId,
        transactionId: `mock-google-${purchaseToken}`,
      });
      return ok({ tier: 'premium', expiresAt });
    }

    const result = await verifyGooglePlay(productId, purchaseToken);
    if (!result.ok) return err(result.reason, 400);

    const user = await this.userRepo.findById(userId);
    if (!user) return err('User not found', 404);

    if (user.subscriptionTransactionId === result.orderId) {
      return ok({ tier: 'premium', expiresAt: result.expiresAt });
    }

    await this.userRepo.updateSubscriptionTier(userId, 'premium', {
      expiresAt: result.expiresAt, store: 'google',
      productId: result.productId, transactionId: result.orderId,
    });
    return ok({ tier: 'premium', expiresAt: result.expiresAt });
  }

  async handleAppleWebhook(payload: AppleWebhookPayload): Promise<Result<{ received: boolean }>> {
    const decoded = decodeAppleWebhook(payload);
    if (!decoded) return err('invalid payload', 400);

    const notificationType = decoded.notificationType as string | undefined;
    const decodedData = decoded.data as Record<string, unknown> | undefined;
    const appAccountToken = decodedData?.appAccountToken as string | undefined;

    if (!notificationType || !['DID_RENEW', 'SUBSCRIBED', 'DID_CHANGE_RENEWAL_STATUS'].includes(notificationType)) {
      return ok({ received: true });
    }

    const transactionJws = decodedData?.signedTransactionInfo as string | undefined;
    if (!transactionJws || !appAccountToken) return ok({ received: true });

    await this.verifyApplePurchase(appAccountToken as UserId, '');
    return ok({ received: true });
  }

  async handleGoogleWebhook(message: { data: string }): Promise<Result<{ received: boolean }>> {
    const raw = Buffer.from(message.data, 'base64').toString('utf-8');
    const notification = JSON.parse(raw);
    const { subscriptionNotification } = notification;
    if (!subscriptionNotification) return ok({ received: true });

    const { notificationType, purchaseToken, subscriptionId } = subscriptionNotification;
    if (![1, 2, 4].includes(notificationType)) return ok({ received: true });

    const result = await verifyGooglePlay(subscriptionId, purchaseToken);
    if (!result.ok) return ok({ received: true });

    return ok({ received: true });
  }
}
