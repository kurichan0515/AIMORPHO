import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth';

interface AuthState {
  userId: string | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  isLoggedIn: false,

  init: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    const uid = await AsyncStorage.getItem('userId');
    set({ isLoggedIn: !!token, userId: uid });
  },

  login: async (email, password) => {
    const data = await apiLogin(email, password);
    await AsyncStorage.setItem('userId', data.userId);
    set({ isLoggedIn: true, userId: data.userId });
  },

  register: async (email, password, displayName) => {
    const data = await apiRegister(email, password, displayName);
    await AsyncStorage.setItem('userId', data.userId);
    set({ isLoggedIn: true, userId: data.userId });
  },

  logout: async () => {
    await apiLogout();
    await AsyncStorage.removeItem('userId');
    set({ isLoggedIn: false, userId: null });
  },
}));
