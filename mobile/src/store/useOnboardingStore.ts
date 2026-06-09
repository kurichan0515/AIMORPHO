import { create } from 'zustand';

interface OnboardingStore {
  heightCm: number | null;
  currentWeightKg: number | null;
  gender: 'male' | 'female' | 'other' | null;
  setProfile: (data: { heightCm: number; currentWeightKg: number; gender: string | null }) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  heightCm: null,
  currentWeightKg: null,
  gender: null,
  setProfile: ({ heightCm, currentWeightKg, gender }) =>
    set({ heightCm, currentWeightKg, gender: gender as OnboardingStore['gender'] }),
  reset: () => set({ heightCm: null, currentWeightKg: null, gender: null }),
}));
