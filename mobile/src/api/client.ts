import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const BASE_URL = __DEV__
  ? (Platform.OS === 'android' ? 'http://192.168.1.4:3001' : 'http://localhost:3000')
  : (process.env.API_BASE_URL ?? 'https://api.aimorpho.example.com');

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status !== 401) return Promise.reject(err);

    const refresh = await AsyncStorage.getItem('refreshToken');
    if (!refresh) return Promise.reject(err);

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
      await AsyncStorage.setItem('accessToken', data.accessToken);
      err.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api.request(err.config);
    } catch {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      return Promise.reject(err);
    }
  }
);

export default api;
