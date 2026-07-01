import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

// Replace TEST_IDs with production ad unit IDs from AdMob console
const ANDROID_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';

const IOS_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';

const AD_UNIT_ID = Platform.OS === 'ios' ? IOS_AD_UNIT_ID : ANDROID_AD_UNIT_ID;

const DAILY_LIMIT = 2;
const STORAGE_KEY = 'dailyInterstitialAdCount';

// アプリ起動・体重記録など複数トリガーで共有する単一インスタンス。
// 1日2回までの上限をAsyncStorageで管理する。
const ad = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
  requestNonPersonalizedAdsOnly: false,
});
let loaded = false;
let initialized = false;

function init(): void {
  if (initialized) { return; }
  initialized = true;
  ad.addAdEventListener(AdEventType.LOADED, () => { loaded = true; });
  ad.addAdEventListener(AdEventType.CLOSED, () => { loaded = false; ad.load(); });
  ad.addAdEventListener(AdEventType.ERROR, () => { loaded = false; });
  ad.load();
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getTodayCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) { return 0; }
  const { date, count } = JSON.parse(raw) as { date: string; count: number };
  return date === todayString() ? count : 0;
}

async function incrementTodayCount(): Promise<void> {
  const count = await getTodayCount();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayString(), count: count + 1 }));
}

// 広告ロードを早めるため、非プレミアムと確定した時点で外部から呼び出せるよう公開する。
export function initDailyInterstitial(): void {
  init();
}

// 1日2回の上限内かつ広告ロード済みなら表示する。それ以外は何もしない（呼び出し側でエラー処理不要）。
export async function showDailyInterstitial(): Promise<void> {
  init();
  if (!loaded) { return; }
  loaded = false; // 同時呼び出しでの二重showを防ぐため即座にロック
  const count = await getTodayCount();
  if (count >= DAILY_LIMIT) {
    loaded = true; // 上限到達時は広告を温存（ロード済みのまま）
    return;
  }
  await incrementTodayCount();
  ad.show();
}
