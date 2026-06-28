import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  anonymousAuth, upgradeAccount as apiUpgrade,
  login as apiLogin, logout as apiLogout,
} from '../api/auth';
import { fetchAvatar } from '../api/avatar';
import { useAvatarStore } from './useAvatarStore';
import { getDeviceId, regenerateDeviceId } from '../utils/deviceId';
import { requestNotificationPermission, getFcmToken } from '../utils/notifications';
import api from '../api/client';

const ONBOARDING_KEY = 'onboardingCompleted';
const IS_ANONYMOUS_KEY = 'isAnonymous';

const registerFcmToken = async (): Promise<void> => {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    const token = await getFcmToken();
    if (token) await api.put('/users/me/fcm-token', { fcmToken: token });
  } catch {}
};

interface AuthState {
  userId: string | null;
  isLoggedIn: boolean;
  isAnonymous: boolean;
  onboardingCompleted: boolean;
  isInitialized: boolean;

  init: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  upgradeAccount: (email: string, password: string) => Promise<void>;
  loginAndRestore: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetGuestData: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  isLoggedIn: false,
  isAnonymous: true,
  onboardingCompleted: false,
  isInitialized: false,

  init: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    const uid = await AsyncStorage.getItem('userId');
    const done = await AsyncStorage.getItem(ONBOARDING_KEY);
    const anon = await AsyncStorage.getItem(IS_ANONYMOUS_KEY);

    if (token && uid) {
      const isAnonymous = anon !== 'false';
      set({ isLoggedIn: true, userId: uid, isAnonymous, onboardingCompleted: done === 'true', isInitialized: true });
      const [avatar] = await Promise.all([fetchAvatar(), registerFcmToken()]);
      if (avatar) {
        useAvatarStore.getState().setAvatarImages(avatar.avatarImages, avatar.regenerateCount);
        useAvatarStore.getState().setBodyState(avatar.bodyState);
        useAvatarStore.getState().setMissedDays(avatar.missedDays);
      }
    } else {
      const deviceId = await getDeviceId();
      const data = await anonymousAuth(deviceId);
      await AsyncStorage.multiSet([
        ['userId', data.userId],
        [IS_ANONYMOUS_KEY, 'true'],
      ]);
      set({ isLoggedIn: true, userId: data.userId, isAnonymous: true, onboardingCompleted: done === 'true', isInitialized: true });
    }
  },

  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    set({ onboardingCompleted: true });
  },

  upgradeAccount: async (email: string, password: string) => {
    await apiUpgrade(email, password);
    await AsyncStorage.setItem(IS_ANONYMOUS_KEY, 'false');
    set({ isAnonymous: false });
  },

  loginAndRestore: async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    await AsyncStorage.multiSet([
      ['userId', data.userId],
      [IS_ANONYMOUS_KEY, 'false'],
      [ONBOARDING_KEY, 'true'],
    ]);
    set({ userId: data.userId, isAnonymous: false, onboardingCompleted: true });
    const avatar = await fetchAvatar();
    if (avatar) {
      useAvatarStore.getState().setAvatarImages(avatar.avatarImages, avatar.regenerateCount);
      useAvatarStore.getState().setBodyState(avatar.bodyState);
      useAvatarStore.getState().setMissedDays(avatar.missedDays);
    }
  },

  logout: async () => {
    await apiLogout();
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userId', ONBOARDING_KEY, IS_ANONYMOUS_KEY, 'myGroupId']);
    set({ isLoggedIn: false, userId: null, isAnonymous: true, onboardingCompleted: false, isInitialized: false });
    await get().init();
  },

  resetGuestData: async () => {
    // deviceIdを再発行しないと init() が同じ匿名ユーザーに復帰し、サーバー側データが残ってしまう
    await regenerateDeviceId();
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userId', ONBOARDING_KEY, IS_ANONYMOUS_KEY, 'myGroupId']);
    useAvatarStore.getState().reset();
    set({ isLoggedIn: false, userId: null, isAnonymous: true, onboardingCompleted: false, isInitialized: false });
    await get().init();
  },
}));
