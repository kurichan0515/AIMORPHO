import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth';

const ONBOARDING_KEY = 'onboardingCompleted';

interface AuthState {
  userId: string | null;
  isLoggedIn: boolean;
  onboardingCompleted: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  isLoggedIn: false,
  onboardingCompleted: false,

  init: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    const uid = await AsyncStorage.getItem('userId');
    const done = await AsyncStorage.getItem(ONBOARDING_KEY);
    set({ isLoggedIn: !!token, userId: uid, onboardingCompleted: done === 'true' });
  },

  login: async (email, password) => {
    const data = await apiLogin(email, password);
    await AsyncStorage.setItem('userId', data.userId);
    set({ isLoggedIn: true, userId: data.userId, onboardingCompleted: true });
  },

  register: async (email, password) => {
    const data = await apiRegister(email, password);
    await AsyncStorage.setItem('userId', data.userId);
    set({ isLoggedIn: true, userId: data.userId, onboardingCompleted: false });
  },

  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    set({ onboardingCompleted: true });
  },

  logout: async () => {
    await apiLogout();
    await AsyncStorage.multiRemove(['userId', ONBOARDING_KEY]);
    set({ isLoggedIn: false, userId: null, onboardingCompleted: false });
  },
}));
