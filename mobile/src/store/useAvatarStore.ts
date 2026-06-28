import { create } from 'zustand';
import { Gender } from '../utils/defaultAvatars';

interface AvatarState {
  bodyState: number;
  avatarImages: Record<number, string | null>;
  missedDays: number;
  regenerateCount: number;
  gender: Gender | null;
  useDefault: boolean;
  setBodyState: (state: number) => void;
  setAvatarImages: (images: Record<number, string | null>, count: number) => void;
  setMissedDays: (days: number) => void;
  setGender: (gender: Gender) => void;
  setUseDefault: (val: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  bodyState: 0,
  avatarImages: {},
  missedDays: 0,
  regenerateCount: 0,
  gender: null,
  useDefault: false,
};

export const useAvatarStore = create<AvatarState>((set) => ({
  ...INITIAL_STATE,
  setBodyState: (bodyState) => set({ bodyState }),
  setAvatarImages: (avatarImages, regenerateCount) => set({ avatarImages, regenerateCount, useDefault: false }),
  setMissedDays: (missedDays) => set({ missedDays }),
  setGender: (gender) => set({ gender }),
  setUseDefault: (useDefault) => set({ useDefault }),
  reset: () => set(INITIAL_STATE),
}));
