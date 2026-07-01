import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAiUsage } from '../api/ai';
import { initDailyInterstitial, showDailyInterstitial } from '../ads/dailyInterstitial';

// アプリ起動・体重記録などの自然な区切りでインステ広告を出す（1日2回まで）。
// プレミアムユーザーには表示しない。AI機能のリワード広告フローとは独立。
export function useDailyInterstitialAd() {
  const { data: aiUsage } = useQuery({ queryKey: ['aiUsage'], queryFn: getAiUsage, staleTime: 1000 * 60 * 5 });
  const premium = aiUsage?.premium ?? false;

  // aiUsage確定後にプリロード開始（トリガーより先にロードを進める）
  useEffect(() => {
    if (aiUsage && !premium) { initDailyInterstitial(); }
  }, [aiUsage, premium]);

  const trigger = useCallback(() => {
    if (!aiUsage || premium) { return; }
    showDailyInterstitial();
  }, [aiUsage, premium]);

  return { trigger };
}
