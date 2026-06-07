const { ok, error } = require('/opt/layer-auth');
const { get, put, update, query } = require('/opt/layer-db');

exports.handler = async (event) => {
  const { httpMethod, path, body: rawBody, requestContext } = event;
  const userId = requestContext?.authorizer?.userId;
  if (!userId) return error('Unauthorized', 401);

  const body = rawBody ? JSON.parse(rawBody) : {};

  try {
    if (path === '/users/me'          && httpMethod === 'GET')  return getProfile(userId);
    if (path === '/users/me'          && httpMethod === 'PUT')  return updateProfile(userId, body);
    if (path === '/users/me/goal'     && httpMethod === 'GET')  return getGoal(userId);
    if (path === '/users/me/goal'     && httpMethod === 'POST') return upsertGoal(userId, body);
    if (path === '/users/me/streak'   && httpMethod === 'GET')  return getStreak(userId);
    if (path === '/users/me/badges'   && httpMethod === 'GET')  return getBadges(userId);
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};

async function getProfile(userId) {
  const profile = await get(`USER#${userId}`, 'PROFILE');
  if (!profile) return error('User not found', 404);
  const { passwordHash, ...safe } = profile;
  return ok(safe);
}

async function updateProfile(userId, body) {
  const allowed = ['displayName', 'age', 'heightCm', 'weightKg', 'bodyFatPct', 'lifestyle', 'aiTone', 'bodyBalance'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(updates).length) return error('No valid fields to update');

  const names = {}, values = {};
  const exprs = Object.entries(updates).map(([k, v], i) => {
    names[`#f${i}`] = k;
    values[`:v${i}`] = v;
    return `#f${i} = :v${i}`;
  });

  const updated = await update(`USER#${userId}`, 'PROFILE', `SET ${exprs.join(', ')}`, names, values);
  const { passwordHash, ...safe } = updated;
  return ok(safe);
}

async function getGoal(userId) {
  const goal = await get(`USER#${userId}`, 'GOAL#ACTIVE');
  if (!goal) return error('No active goal', 404);
  return ok(goal);
}

async function upsertGoal(userId, { targetWeight, mode }) {
  if (!targetWeight || !mode) return error('targetWeight and mode required');
  if (!['diet', 'maintain'].includes(mode)) return error('mode must be diet or maintain');

  const now = new Date().toISOString();
  await put({ PK: `USER#${userId}`, SK: 'GOAL#ACTIVE', targetWeight, mode, startedAt: now });
  return ok({ targetWeight, mode, startedAt: now }, 201);
}

async function getStreak(userId) {
  const streak = await get(`USER#${userId}`, 'STREAK');
  return ok(streak || { currentDays: 0, longestDays: 0 });
}

async function getBadges(userId) {
  const items = await query({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'BADGE#' },
  });
  return ok(items);
}
