const { calcBMR, calcTDEE, checkRecoveryCondition, ACTIVITY_FACTORS } = require('../layers/layer-db/health-calc');

describe('calcBMR', () => {
  test('male 30y 170cm 70kg', () => {
    const bmr = calcBMR({ gender: 'male', weightKg: 70, heightCm: 170, age: 30 });
    // 10*70 + 6.25*170 - 5*30 + 5 = 700 + 1062.5 - 150 + 5 = 1617.5
    expect(bmr).toBe(1617.5);
  });

  test('female 25y 160cm 55kg', () => {
    const bmr = calcBMR({ gender: 'female', weightKg: 55, heightCm: 160, age: 25 });
    // 10*55 + 6.25*160 - 5*25 - 161 = 550 + 1000 - 125 - 161 = 1264
    expect(bmr).toBe(1264);
  });
});

describe('calcTDEE', () => {
  test('moderate lifestyle', () => {
    const tdee = calcTDEE({ gender: 'male', weightKg: 70, heightCm: 170, age: 30, lifestyle: 'moderate' });
    expect(tdee).toBe(Math.round(1617.5 * 1.55));
  });

  test('unknown lifestyle falls back to moderate', () => {
    const tdee1 = calcTDEE({ gender: 'male', weightKg: 70, heightCm: 170, age: 30, lifestyle: 'unknown' });
    const tdee2 = calcTDEE({ gender: 'male', weightKg: 70, heightCm: 170, age: 30, lifestyle: 'moderate' });
    expect(tdee1).toBe(tdee2);
  });
});

describe('checkRecoveryCondition', () => {
  const baseArgs = {
    streakDays: 3,
    recentExercise: [{ completed: true }, { completed: true }, { completed: true }],
    recentKcal3days: [1800, 1900, 1700],
    tdee: 2000,
  };

  test('all conditions met → true', () => {
    expect(checkRecoveryCondition(baseArgs)).toBe(true);
  });

  test('streak < 3 → false', () => {
    expect(checkRecoveryCondition({ ...baseArgs, streakDays: 2 })).toBe(false);
  });

  test('exercise not all completed → false', () => {
    const args = { ...baseArgs, recentExercise: [{ completed: true }, { completed: false }, { completed: true }] };
    expect(checkRecoveryCondition(args)).toBe(false);
  });

  test('exercise < 3 records → false', () => {
    expect(checkRecoveryCondition({ ...baseArgs, recentExercise: [{ completed: true }, { completed: true }] })).toBe(false);
  });

  test('avg kcal > tdee → false', () => {
    expect(checkRecoveryCondition({ ...baseArgs, recentKcal3days: [2200, 2100, 2300] })).toBe(false);
  });

  test('avg kcal === tdee → true (境界値)', () => {
    expect(checkRecoveryCondition({ ...baseArgs, recentKcal3days: [2000, 2000, 2000] })).toBe(true);
  });
});
