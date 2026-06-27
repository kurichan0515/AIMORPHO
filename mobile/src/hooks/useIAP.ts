import { useEffect, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import {
  initConnection,
  endConnection,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
} from 'react-native-iap';
import { useQueryClient } from '@tanstack/react-query';
import { verifyApplePurchase, verifyGooglePurchase } from '../api/subscription';

export const PREMIUM_SKU = 'com.aimorpho.premium.monthly';

export function useIAP() {
  const qc = useQueryClient();
  const purchaseListenerRef = useRef<ReturnType<typeof purchaseUpdatedListener> | null>(null);
  const errorListenerRef    = useRef<ReturnType<typeof purchaseErrorListener>   | null>(null);

  useEffect(() => {
    initConnection().catch(() => {});

    purchaseListenerRef.current = purchaseUpdatedListener(async (purchase) => {
      try {
        if (Platform.OS === 'ios') {
          const transactionId = (purchase as any).transactionId as string | undefined;
          if (!transactionId) return;
          await verifyApplePurchase(transactionId);
        } else {
          const purchaseToken = (purchase as any).purchaseToken as string | undefined;
          const productId     = (purchase as any).productId     as string | undefined;
          if (!purchaseToken || !productId) return;
          await verifyGooglePurchase(productId, purchaseToken);
        }

        await finishTransaction({ purchase, isConsumable: false });
        qc.invalidateQueries({ queryKey: ['profile'] });
        Alert.alert('プレミアム登録完了！', 'プレミアムプランをご利用いただけます。');
      } catch {
        Alert.alert('エラー', '購入の確認に失敗しました。サポートにお問い合わせください。');
      }
    });

    errorListenerRef.current = purchaseErrorListener((error) => {
      if ((error as any).code === 'E_USER_CANCELLED') return;
      Alert.alert('購入エラー', '購入処理に失敗しました。しばらく経ってからお試しください。');
    });

    return () => {
      purchaseListenerRef.current?.remove();
      errorListenerRef.current?.remove();
      endConnection().catch(() => {});
    };
  }, [qc]);

  const purchase = useCallback(async () => {
    try {
      await requestPurchase({
        request: {
          apple:  { sku: PREMIUM_SKU },
          google: { skus: [PREMIUM_SKU] },
        },
        type: 'subs',
      });
    } catch {
      // purchaseErrorListener で処理
    }
  }, []);

  return { purchase };
}
