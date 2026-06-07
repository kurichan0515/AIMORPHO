const { ok, error } = require('/opt/layer-auth');
const { get, put, update, query } = require('/opt/layer-db');

exports.handler = async (event) => {
  const { httpMethod, path, body: rawBody, queryStringParameters, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  if (!userId) return error('Unauthorized', 401);

  const body = rawBody ? JSON.parse(rawBody) : {};
  const qs = queryStringParameters || {};

  try {
    if (path === '/logs/weight'    && httpMethod === 'POST') return recordWeight(userId, body);
    if (path === '/logs/weight'    && httpMethod === 'GET')  return getWeightHistory(userId, qs);
    if (path === '/logs/exercise'  && httpMethod === 'POST') return recordExercise(userId, body);
    if (path === '/logs/exercise'  && httpMethod === 'GET')  return getExerciseHistory(userId, qs);
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

  await checkAndUpdateStreak(userId, now);
  await checkGoalAchievement(userId, weightKg);

  return ok({ weightKg, recordedAt: now }, 201);
}

async function getWeightHistory(userId, { from, to, limit = '30' }) {
  const params = {
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':from': `WEIGHT#${from || '1970'}`,
      ':to': `WEIGHT#${to || '9999'}`,
    },
    ScanIndexForward: false,
    Limit: parseInt(limit, 10),
  };
  const items = await query(params);
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

  return ok({ exerciseName, completed, recordedAt: now }, 201);
}

async function getExerciseHistory(userId, { from, to, limit = '30' }) {
  const params = {
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':from': `EXERCISE#${from || '1970'}`,
      ':to': `EXERCISE#${to || '9999'}`,
    },
    ScanIndexForward: false,
    Limit: parseInt(limit, 10),
  };
  const items = await query(params);
  return ok(items);
}

async function checkAndUpdateStreak(userId, now) {
  const streak = await get(`USER#${userId}`, 'STREAK') || { currentDays: 0, longestDays: 0 };
  const lastDate = streak.lastLoggedAt ? streak.lastLoggedAt.slice(0, 10) : null;
  const todayJST = new Date(now).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '-');

  if (lastDate === todayJST) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '-');

  const newCurrent = lastDate === yesterdayStr ? streak.currentDays + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestDays);

  await put({
    PK: `USER#${userId}`,
    SK: 'STREAK',
    currentDays: newCurrent,
    longestDays: newLongest,
    lastLoggedAt: now,
  });
}

async function checkGoalAchievement(userId, currentWeight) {
  const goal = await get(`USER#${userId}`, 'GOAL#ACTIVE');
  if (!goal || goal.achievedAt) return;
  if (goal.mode === 'diet' && currentWeight <= goal.targetWeight) {
    await update(
      `USER#${userId}`, 'GOAL#ACTIVE',
      'SET achievedAt = :now',
      undefined,
      { ':now': new Date().toISOString() }
    );
  }
}
