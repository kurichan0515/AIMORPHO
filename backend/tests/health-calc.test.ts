import { calcBMR, calcTDEE } from '../src/domain/health/HealthCalc';
import { checkRecoveryCondition } from '../src/domain/health/RecoveryService';

describe('calcBMR', () => {
  test('male 30y 170cm 70kg', () => {
    expect(calcBMR({ gender: 'male', weightKg: 70, heightCm: 170, age: 30 })).toBe(1617.5);
  });

  test('female 25y 160cm 55kg', () => {
    expect(calcBMR({ gender: 'female', weightKg: 55, heightCm: 160, age: 25 })).toBe(1264);
  });
});

describe('calcTDEE', () => {
  test('moderate lifestyle', () => {
    const tdee = calcTDEE({ gender: 'male', weightKg: 70, heightCm: 170, age: 30, lifestyle: 'moderate' });
    expect(tdee).toBe(Math.round(1617.5 * 1.55));
  });
});

describe('checkRecoveryCondition', () => {
  const makeExercise = (completed: boolean) => ({
    userId: 'u1', exerciseName: 'run', durationMin: 30, kcalBurned: 200, completed, recordedAt: new Date().toISOString(),
  });

  const base = {
    streakDays: 3,
    recentExercise: [makeExercise(true), makeExercise(true), makeExercise(true)],
    recentKcal3days: [1800, 1900, 1700],
    tdee: 2000,
  };

  test('all conditions met → true', () => { expect(checkRecoveryCondition(base)).toBe(true); });
  test('streak < 3 → false',        () => { expect(checkRecoveryCondition({ ...base, streakDays: 2 })).toBe(false); });
  test('exercise not completed → false', () => {
    expect(checkRecoveryCondition({ ...base, recentExercise: [makeExercise(true), makeExercise(false), makeExercise(true)] })).toBe(false);
  });
  test('exercise < 3 → false', () => {
    expect(checkRecoveryCondition({ ...base, recentExercise: [makeExercise(true), makeExercise(true)] })).toBe(false);
  });
  test('avg kcal > tdee → false', () => {
    expect(checkRecoveryCondition({ ...base, recentKcal3days: [2200, 2100, 2300] })).toBe(false);
  });
  test('avg kcal === tdee → true', () => {
    expect(checkRecoveryCondition({ ...base, recentKcal3days: [2000, 2000, 2000] })).toBe(true);
  });
});
