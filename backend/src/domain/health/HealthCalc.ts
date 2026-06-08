import { Gender, Lifestyle } from '../shared/types';

const ACTIVITY_FACTORS: Record<Lifestyle, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

export const calcBMR = ({ gender, weightKg, heightCm, age }: {
  gender?: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
}): number => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'male')   return base + 5;
  if (gender === 'female') return base - 161;
  return base - 78;
};

export const calcTDEE = (profile: {
  gender?: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
  lifestyle: Lifestyle;
}): number => {
  const bmr = calcBMR(profile);
  const factor = ACTIVITY_FACTORS[profile.lifestyle] ?? 1.55;
  return Math.round(bmr * factor);
};
