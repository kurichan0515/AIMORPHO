import { create } from 'zustand';

interface AvatarState {
  bodyState: number;
  avatarImages: Record<number, string | null>;
  missedDays: number;
  setBodyState: (state: number) => void;
  setAvatarImages: (images: Record<number, string | null>) => void;
  setMissedDays: (days: number) => void;
}

export const useAvatarStore = create<AvatarState>((set) => ({
  bodyState: 0,
  avatarImages: {},
  missedDays: 0,
  setBodyState: (bodyState) => set({ bodyState }),
  setAvatarImages: (avatarImages) => set({ avatarImages }),
  setMissedDays: (missedDays) => set({ missedDays }),
}));
