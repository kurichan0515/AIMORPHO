import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './client';

export const register = async (email: string, password: string, displayName?: string) => {
  const { data } = await api.post('/auth/register', { email, password, displayName });
  await saveTokens(data.accessToken, data.refreshToken);
  return data;
};

export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });
  await saveTokens(data.accessToken, data.refreshToken);
  return data;
};

export const logout = async () => {
  const refresh = await AsyncStorage.getItem('refreshToken');
  if (refresh) await api.post('/auth/logout', { refreshToken: refresh }).catch(() => {});
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
};

const saveTokens = (access: string, refresh: string) =>
  AsyncStorage.multiSet([['accessToken', access], ['refreshToken', refresh]]);
