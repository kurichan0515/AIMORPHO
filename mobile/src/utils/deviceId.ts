import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'deviceId';

const generateUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const getDeviceId = async (): Promise<string> => {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

// ゲストデータのリセット用。新しいdeviceIdを発行 → 次回init()で別の匿名ユーザーとして開始する。
export const regenerateDeviceId = async (): Promise<string> => {
  const id = generateUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
};
