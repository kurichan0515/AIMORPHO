// ライフスタイル → 活動係数
const ACTIVITY_FACTORS = {
  sedentary:    1.2,
  light:        1.375,
  moderate:     1.55,
  active:       1.725,
  very_active:  1.9,
};

// Mifflin-St Jeor式 BMR
function calcBMR({ gender = 'other', weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'male')   return base + 5;
  if (gender === 'female') return base - 161;
  return base - 78; // other: 中間値
}

// TDEE = BMR × 活動係数
function calcTDEE(profile) {
  const bmr = calcBMR(profile);
  const factor = ACTIVITY_FACTORS[profile.lifestyle] ?? 1.55;
  return Math.round(bmr * factor);
}

// 回復条件チェック（設計書6.1）
// - 3日連続ログイン (streak.currentDays >= 3)
// - 直近3日すべて completed:true の運動記録あり
// - 直近3日平均摂取kcal <= TDEE
function checkRecoveryCondition({ streakDays, recentExercise, recentKcal3days, tdee }) {
  if (streakDays < 3) return false;
  const allExercised = recentExercise.length >= 3 && recentExercise.every(e => e.completed === true);
  if (!allExercised) return false;
  const avgKcal = recentKcal3days.reduce((s, v) => s + v, 0) / 3;
  return avgKcal <= tdee;
}

module.exports = { calcBMR, calcTDEE, checkRecoveryCondition, ACTIVITY_FACTORS };
