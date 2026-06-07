const { ok, error } = require('/opt/layer-auth');
const { get, put, query, update, nextDayJSTEpoch } = require('/opt/layer-db');
const { generateDailyAdvice, generateInterrogationMessage } = require('/opt/layer-gemini');

exports.handler = async (event) => {
  const { httpMethod, path, body: rawBody, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  if (!userId) return error('Unauthorized', 401);

  const body = rawBody ? JSON.parse(rawBody) : {};

  try {
    if (path === '/ai/daily-advice'  && httpMethod === 'GET')  return getDailyAdvice(userId);
    if (path === '/ai/penalty-event' && httpMethod === 'POST') return handlePenaltyEvent(userId, body);
    if (path === '/ai/goal-message'  && httpMethod === 'GET')  return getGoalMessage(userId);
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};

async function getDailyAdvice(userId) {
  const todayJST = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
    .replace(/\//g, '-').split('-').map(p => p.padStart(2, '0')).join('-');

  const cached = await get(`USER#${userId}`, `ADVICE#${todayJST}`);
  if (cached) return ok(cached);

  const [profile, goal, streak, avatar] = await Promise.all([
    get(`USER#${userId}`, 'PROFILE'),
    get(`USER#${userId}`, 'GOAL#ACTIVE'),
    get(`USER#${userId}`, 'STREAK'),
    get(`USER#${userId}`, 'AVATAR'),
  ]);

  if (!profile) return error('User not found', 404);

  const recentWeights = await query({
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': 'WEIGHT#2020', ':to': 'WEIGHT#9999' },
    ScanIndexForward: false,
    Limit: 7,
  });

  const recentMeals = await query({
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': 'MEAL#2020', ':to': 'MEAL#9999' },
    ScanIndexForward: false,
    Limit: 9,
  });

  const recentExercises = await query({
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':from': 'EXERCISE#2020', ':to': 'EXERCISE#9999' },
    ScanIndexForward: false,
    Limit: 9,
  });

  const ctx = {
    age: profile.age || 30,
    heightCm: profile.heightCm || 165,
    currentWeight: recentWeights[0]?.weightKg || profile.weightKg || 60,
    targetWeight: goal?.targetWeight || 55,
    lifestyle: profile.lifestyle || 'moderate',
    aiTone: profile.aiTone || 'friendly',
    currentDays: streak?.currentDays || 0,
    bodyState: avatar?.bodyState || 0,
    recentWeights: recentWeights.map(w => w.weightKg),
    recentKcal: groupByDay(recentMeals, 'kcal', 3),
    recentExercise: recentExercises.slice(0, 3).map(e => e.exerciseName),
  };

  const advice = await generateDailyAdvice(ctx);
  const now = new Date().toISOString();
  const item = {
    PK: `USER#${userId}`,
    SK: `ADVICE#${todayJST}`,
    ...advice,
    generatedAt: now,
    ttl: nextDayJSTEpoch(),
  };
  await put(item);
  return ok(item);
}

async function handlePenaltyEvent(userId, { answer }) {
  const streak = await get(`USER#${userId}`, 'STREAK');
  if (!streak?.lastLoggedAt) return ok({ event: 'none' });

  const lastDate = new Date(streak.lastLoggedAt);
  const now = new Date();
  const diffMs = now - lastDate;
  const missedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (missedDays < 3) return ok({ event: 'none', missedDays });

  const avatar = await get(`USER#${userId}`, 'AVATAR') || { bodyState: 0, missedDays: 0 };

  if (answer === 'YES') {
    await update(`USER#${userId}`, 'STREAK', 'SET currentDays = :zero, missedDays = :zero',
      undefined, { ':zero': 0 });
    return ok({ event: 'penalty', result: 'lash', bodyStateChanged: false, missedDays });
  }

  if (answer === 'NO') {
    const newBodyState = Math.min((avatar.bodyState || 0) + 1, 4);
    await Promise.all([
      update(`USER#${userId}`, 'AVATAR', 'SET bodyState = :bs, missedDays = :zero',
        undefined, { ':bs': newBodyState, ':zero': 0 }),
      update(`USER#${userId}`, 'STREAK', 'SET currentDays = :zero, missedDays = :zero',
        undefined, { ':zero': 0 }),
    ]);
    return ok({ event: 'penalty', result: 'lash_and_degrade', newBodyState, missedDays });
  }

  // まだ回答なし → AI生成の尋問メッセージ
  const profile = await get(`USER#${userId}`, 'PROFILE');
  const question = await generateInterrogationMessage({
    missedDays,
    aiTone: profile?.aiTone || 'friendly',
  }).catch(() => `この${missedDays}日間、運動はしましたか？`);
  return ok({ event: 'interrogation', missedDays, question });
}

async function getGoalMessage(userId) {
  const [goal, profile] = await Promise.all([
    get(`USER#${userId}`, 'GOAL#ACTIVE'),
    get(`USER#${userId}`, 'PROFILE'),
  ]);
  if (!goal?.achievedAt) return error('Goal not yet achieved', 400);

  const message = `おめでとうございます！目標体重${goal.targetWeight}kgを達成しました！🎉`;
  return ok({ message, achievedAt: goal.achievedAt });
}

function groupByDay(logs, field, days) {
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '-');
    const dayLogs = logs.filter(l => l.SK.includes(dateStr));
    result.push(dayLogs.reduce((sum, l) => sum + (l[field] || 0), 0));
  }
  return result;
}
