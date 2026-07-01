import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { issueRewardToken } from '../api/ai';

// Replace TEST_IDs with production ad unit IDs from AdMob console
const ANDROID_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';

const IOS_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';

const AD_UNIT_ID = Platform.OS === 'ios' ? IOS_AD_UNIT_ID : ANDROID_AD_UNIT_ID;

// 無料ユーザーがAI機能を使う直前にリワード広告を視聴させる。
// AdMob SSV: 各広告リクエストにサーバー発行のトークンを customData として埋め込む。
// Google がSSVコールバックでトークンを検証済みにした後、AI APIを呼び出す。
export function useRewardedAd() {
  const adRef = useRef<RewardedAd | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const earnedRef = useRef(false);
  const onEarnedRef = useRef<(() => void) | null>(null);

  const setupAd = useCallback(async () => {
    // サーバーからSSV用トークンを取得
    let tokenId: string;
    try {
      const result = await issueRewardToken();
      tokenId = result.tokenId;
    } catch {
      return; // ネットワークエラー — 次のタップ時に再試行
    }
    if (!mountedRef.current) { return; } // アンマウント後は処理しない
    tokenRef.current = tokenId;

    const ad = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
      serverSideVerificationOptions: { customData: tokenId },
    });
    adRef.current = ad;

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      loadedRef.current = true;
      setLoaded(true);
    });
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earnedRef.current = true;
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      loadedRef.current = false;
      setLoaded(false);
      if (earnedRef.current) { onEarnedRef.current?.(); }
      earnedRef.current = false;
      onEarnedRef.current = null;
      cleanupRef.current?.();
      setupAd(); // 次の利用に向けて新しいトークン+広告を準備
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      loadedRef.current = false;
      setLoaded(false);
    });

    cleanupRef.current = () => {
      unsubLoaded(); unsubEarned(); unsubClosed(); unsubError();
    };

    ad.load();
  }, []); // setupAd自体は再生成しない（refで状態管理）

  useEffect(() => {
    mountedRef.current = true;
    setupAd();
    return () => {
      mountedRef.current = false;
      cleanupRef.current?.();
    };
  }, [setupAd]);

  // 広告ロード済みなら show し、視聴完了(EARNED_REWARD)後に onEarned を実行。
  // 未ロードなら false を返す（呼び出し側でフォールバック処理）。
  const show = useCallback((onEarned: () => void): boolean => {
    if (!loadedRef.current) { return false; }
    loadedRef.current = false; // 連打での二重show防止
    setLoaded(false);
    onEarnedRef.current = onEarned;
    adRef.current!.show();
    return true;
  }, []);

  // onEarned コールバック内で最新トークンを読むためのゲッター
  const getToken = useCallback((): string | null => tokenRef.current, []);

  return { loaded, show, getToken };
}
