import { Alert, Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    const status = await messaging().requestPermission();
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
    );
  }
  // Android 13+ requires explicit permission request
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const { PermissionsAndroid } = require('react-native');
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

export const getFcmToken = async (): Promise<string | null> => {
  try {
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }
    return await messaging().getToken();
  } catch {
    return null;
  }
};

export const setupNotificationHandlers = (
  onNavigate?: (screen: string, params?: Record<string, unknown>) => void,
): void => {
  // フォアグラウンド受信
  messaging().onMessage(async (msg: FirebaseMessagingTypes.RemoteMessage) => {
    const { notification, data } = msg;
    Alert.alert(
      notification?.title ?? 'AIMORPHO',
      notification?.body ?? '',
      data?.screen
        ? [
            { text: '閉じる', style: 'cancel' },
            { text: '確認する', onPress: () => onNavigate?.(data.screen as string) },
          ]
        : [{ text: 'OK' }],
    );
  });

  // バックグラウンドからタップで起動
  messaging().onNotificationOpenedApp((msg: FirebaseMessagingTypes.RemoteMessage) => {
    const screen = msg.data?.screen as string | undefined;
    if (screen) onNavigate?.(screen);
  });
};

// アプリ終了状態からの起動チェック（App.tsx の useEffect で一度だけ呼ぶ）
export const checkInitialNotification = async (
  onNavigate?: (screen: string, params?: Record<string, unknown>) => void,
): Promise<void> => {
  const msg = await messaging().getInitialNotification();
  if (msg?.data?.screen) onNavigate?.(msg.data.screen as string);
};
