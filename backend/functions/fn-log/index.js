const { ok, error } = require('/opt/layer-auth');
const { get, put, update, query } = require('/opt/layer-db');
const { checkStreakBadges, checkCountBadges, awardBadge } = require('/opt/layer-db/badge-service');
const { calcTDEE, checkRecoveryCondition } = require('/opt/layer-db/health-calc');

exports.handler = async (event) => {
  const { httpMethod, path, body: rawBody, queryStringParameters, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  if (!userId) return error('Unauthorized', 401);

  const body = rawBody ? JSON.parse(rawBody) : {};
  const qs = queryStringParameters || {};

  try {
    if (path === '/logs/weight'   && httpMethod === 'POST') return recordWeight(userId, body);
    if (path === '/logs/weight'   && httpMethod === 'GET')  return getWeightHistory(userId, qs);
    if (path === '/logs/exercise' && httpMethod === 'POST') return recordExercise(userId, body);
    if (path === '/logs/exercise' && httpMethod === 'GET')  return getExerciseHistory(userId, qs);
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};

async function recordWeight(userId, { weightKg }) {
  if (!weightKg) return error('weightKg required');

  const now = new Date().toISOString();
  await put({ PK: `USER#${userId}`, SK: `WEIGHT#${now}`, weightKg, recordedAt: now });

  const [newStreak] = await Promise.all([
    checkAndUpdateStreak(userId, now),
    checkGoalAchievement(userId, weightKg),
  ]);

  const newBadges = [];
  // 初計測バッジ
  const weightBadge = await awardBadge(userId, 'weight_first');
  if (weightBadge) newBadges.push(weightBadge);
  // ストリークバッジ
  if (newStreak?.currentDays) {
    const sb = await checkStreakBadges(userId, newStreak.currentDays);
    newBadges.push(...sb);
  }

  return ok({ weightKg, recordedAt: now, newBadges }, 201);
}

async function getWeightHistory(userId, { from, to, limit = '30' }) {
  const items = await query({
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':from': `WEIGHT#${from || '1970'}`,
      ':to': `WEIGHT#${to || '9999'}`,
    },
    ScanIndexForward: false,
    Limit: parseInt(limit, 10),
  });
  return ok(items);
}

async function recordExercise(userId, { exerciseName, durationMin, kcalBurned, completed = true }) {
  if (!exerciseName) return error('exerciseName required');

  const now = new Date().toISOString();
  await put({
    PK: `USER#${userId}`,
    SK: `EXERCISE#${now}`,
    exerciseName,
    durationMin: durationMin || 0,
    kcalBurned: kcalBurned || 0,
    completed,
    recordedAt: now,
  });

  const newBadges = [];
  // 運動件数バッジ
  const exerciseLogs = await query({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'EXERCISE#' },
    Select: 'COUNT',
  });
  const eb = await checkCountBadges(userId, 'exercise', exerciseLogs.length);
  newBadges.push(...eb);

  // 回復チェック（completed:true の運動記録時のみ）
  let recovered = false;
  if (completed) {
    recovered = await checkAvatarRecovery(userId);
    if (recovered) {
      const rb = await awardBadge(userId, 'recovery');
      if (rb) newBadges.push(rb);
    }
  }

  return ok({ exerciseName, completed, recordedAt: now, newBadges, recovered }, 201);
}

async function getExerciseHistory(userId, { from, to, limit = '30' }) {
  const items = await query({
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':from': `EXERCISE#${from || '1970'}`,
      ':to': `EXERCISE#${to || '9999'}`,
    },
    ScanIndexForward: false,
    Limit: parseInt(limit, 10),
  });
  return ok(items);
}

// --- helpers ---

async function checkAndUpdateStreak(userId, now) {
  const streak = await get(`USER#${userId}`, 'STREAK') || { currentDays: 0, longestDays: 0 };
  const todayJST = toJSTDate(now);
  const lastDate = streak.lastLoggedAt ? toJSTDate(streak.lastLoggedAt) : null;
  if (lastDate === todayJST) return streak;

  const yesterday = toJSTDate(new Date(Date.now() - 86400000).toISOString());
  const newCurrent = lastDate === yesterday ? streak.currentDays + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestDays);
  const updated = { PK: `USER#${userId}`, SK: 'STREAK', currentDays: newCurrent, longestDays: newLongest, lastLoggedAt: now };
  await put(updated);
  return updated;
}

async function checkGoalAchievement(userId, currentWeight) {
  const goal = await get(`USER#${userId}`, 'GOAL#ACTIVE');
  if (!goal || goal.achievedAt) return;
  if (goal.mode === 'diet' && currentWeight <= goal.targetWeight) {
    await update(`USER#${userId}`, 'GOAL#ACTIVE', 'SET achievedAt = :now', undefined, { ':now': new Date().toISOString() });
    await update(`USER#${userId}`, 'AVATAR', 'SET bodyState = :zero', undefined, { ':zero': 0 });
    await awardBadge(userId, 'goal_achieve');
  }
}

async function checkAvatarRecovery(userId) {
  const [profile, avatar, streak] = await Promise.all([
    get(`USER#${userId}`, 'PROFILE'),
    get(`USER#${userId}`, 'AVATAR'),
    get(`USER#${userId}`, 'STREAK'),
  ]);
  if (!avatar || avatar.bodyState === 0) return false;
  if (!profile) return false;

  const tdee = calcTDEE({
    gender: profile.gender,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    lifestyle: profile.lifestyle,
  });

  // 直近3日の運動記録取得
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const recentExercise = await query({
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': `EXERCISE#${threeDaysAgo}`, ':to': 'EXERCISE#9999' },
    ScanIndexForward: false,
  });

  // 直近3日の食事kcal集計
  const recentMeals = await query({
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': `MEAL#${threeDaysAgo}`, ':to': 'MEAL#9999' },
    ScanIndexForward: false,
  });
  const recentKcal3days = [0, 1, 2].map(i => {
    const d = toJSTDate(new Date(Date.now() - i * 86400000).toISOString());
    return recentMeals.filter(m => m.SK.includes(d)).reduce((s, m) => s + (m.kcal || 0), 0);
  });

  const ok = checkRecoveryCondition({
    streakDays: streak?.currentDays || 0,
    recentExercise,
    recentKcal3days,
    tdee,
  });

  if (ok && avatar.bodyState > 0) {
    await update(`USER#${userId}`, 'AVATAR', 'SET bodyState = :bs', undefined, { ':bs': avatar.bodyState - 1 });
    return true;
  }
  return false;
}

const toJSTDate = (iso) =>
  new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
    .replace(/\//g, '-').split('-').map(p => p.padStart(2, '0')).join('-');
