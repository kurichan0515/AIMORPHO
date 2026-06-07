import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.API_BASE_URL || 'https://YOUR_API_GATEWAY_URL/prod';

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
