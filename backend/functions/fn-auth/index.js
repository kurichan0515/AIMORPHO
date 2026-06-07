const { v4: uuidv4 } = require('uuid');
const { signTokens, verifyToken, hashPassword, comparePassword, ok, error } = require('/opt/layer-auth');
const { get, put, remove } = require('/opt/layer-db');

exports.handler = async (event) => {
  const { httpMethod, path, body: rawBody } = event;
  const body = rawBody ? JSON.parse(rawBody) : {};

  try {
    if (path === '/auth/register' && httpMethod === 'POST') return register(body);
    if (path === '/auth/login'    && httpMethod === 'POST') return login(body);
    if (path === '/auth/refresh'  && httpMethod === 'POST') return refresh(body);
    if (path === '/auth/logout'   && httpMethod === 'POST') return logout(body);
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};

async function register({ email, password, displayName }) {
  if (!email || !password) return error('email and password required');

  const existing = await get(`USER#email#${email}`, 'INDEX');
  if (existing) return error('Email already registered', 409);

  const userId = uuidv4();
  const now = new Date().toISOString();

  await Promise.all([
    put({
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      email,
      displayName: displayName || '',
      passwordHash: await hashPassword(password),
      timezone: 'Asia/Tokyo',
      aiTone: 'friendly',
      createdAt: now,
    }),
    put({ PK: `USER#email#${email}`, SK: 'INDEX', userId }),
  ]);

  const { accessToken, refreshToken } = await signTokens(userId);
  return ok({ accessToken, refreshToken, userId }, 201);
}

async function login({ email, password }) {
  if (!email || !password) return error('email and password required');

  const idx = await get(`USER#email#${email}`, 'INDEX');
  if (!idx) return error('Invalid credentials', 401);

  const profile = await get(`USER#${idx.userId}`, 'PROFILE');
  if (!profile || !(await comparePassword(password, profile.passwordHash))) {
    return error('Invalid credentials', 401);
  }

  const { accessToken, refreshToken } = await signTokens(idx.userId);
  return ok({ accessToken, refreshToken, userId: idx.userId });
}

async function refresh({ refreshToken }) {
  if (!refreshToken) return error('refreshToken required');

  const payload = await verifyToken(refreshToken).catch(() => null);
  if (!payload) return error('Invalid or expired token', 401);

  const blacklisted = await get(`RT#${payload.jti}`, 'BLACKLIST');
  if (blacklisted) return error('Token revoked', 401);

  const { accessToken } = await signTokens(payload.sub);
  return ok({ accessToken });
}

async function logout({ refreshToken }) {
  if (!refreshToken) return error('refreshToken required');

  const payload = await verifyToken(refreshToken).catch(() => null);
  if (!payload) return ok({ message: 'logged out' });

  const expiredAt = payload.exp;
  await put({
    PK: `RT#${payload.jti}`,
    SK: 'BLACKLIST',
    userId: payload.sub,
    expiredAt,
    ttl: expiredAt,
  });

  return ok({ message: 'logged out' });
}
