import { v4 as uuidv4 } from 'uuid';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { User } from '../../domain/user/User';
import { signTokens, verifyToken } from '../../infrastructure/auth/JwtService';
import { hashPassword, comparePassword } from '../../infrastructure/auth/PasswordService';
import { TokenBlacklistRepository } from '../../infrastructure/dynamodb/AdviceRepository';

type AuthDeps = {
  userRepo: IUserRepository;
  blacklist: TokenBlacklistRepository;
};

export const anonymousLogin = async (
  { userRepo }: AuthDeps,
  { userId }: { userId: string }
) => {
  let user = await userRepo.findById(userId);
  if (!user) {
    const now = new Date().toISOString();
    user = {
      userId,
      isAnonymous: true,
      displayName: '',
      lifestyle: 'moderate',
      aiTone: 'friendly',
      timezone: 'Asia/Tokyo',
      createdAt: now,
    };
    await userRepo.create(user);
  }
  const tokens = await signTokens(userId);
  return { data: { ...tokens, userId, isAnonymous: user.isAnonymous }, statusCode: 200 } as const;
};

export const upgradeAccount = async (
  { userRepo }: AuthDeps,
  userId: string,
  { email, password }: { email: string; password: string }
) => {
  const existing = await userRepo.findByEmail(email);
  if (existing && existing.userId !== userId) {
    return { error: 'Email already registered', statusCode: 409 } as const;
  }
  const passwordHash = await hashPassword(password);
  await userRepo.upgradeToRegistered(userId, email, passwordHash);
  await userRepo.createEmailIndex(email, userId);
  const tokens = await signTokens(userId);
  return { data: { ...tokens, userId, isAnonymous: false }, statusCode: 200 } as const;
};

export const register = async (
  { userRepo }: AuthDeps,
  { email, password, displayName }: { email: string; password: string; displayName?: string }
) => {
  const existing = await userRepo.findByEmail(email);
  if (existing) return { error: 'Email already registered', statusCode: 409 } as const;

  const userId = uuidv4();
  const now = new Date().toISOString();
  const user: User = {
    userId, email,
    isAnonymous: false,
    displayName: displayName ?? '',
    passwordHash: await hashPassword(password),
    lifestyle: 'moderate',
    aiTone: 'friendly',
    timezone: 'Asia/Tokyo',
    createdAt: now,
  };

  await Promise.all([
    userRepo.create(user),
    userRepo.createEmailIndex(email, userId),
  ]);

  const tokens = await signTokens(userId);
  return { data: { ...tokens, userId, isAnonymous: false }, statusCode: 201 } as const;
};

export const login = async (
  { userRepo }: AuthDeps,
  { email, password }: { email: string; password: string }
) => {
  const user = await userRepo.findByEmail(email);
  if (!user || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    return { error: 'Invalid credentials', statusCode: 401 } as const;
  }
  const tokens = await signTokens(user.userId);
  return { data: { ...tokens, userId: user.userId, isAnonymous: false }, statusCode: 200 } as const;
};

export const refresh = async (
  { blacklist }: AuthDeps,
  { refreshToken }: { refreshToken: string }
) => {
  const payload = await verifyToken(refreshToken).catch(() => null);
  if (!payload) return { error: 'Invalid or expired token', statusCode: 401 } as const;

  if (payload.jti && await blacklist.isBlacklisted(payload.jti)) {
    return { error: 'Token revoked', statusCode: 401 } as const;
  }

  const { accessToken } = await signTokens(payload.sub);
  return { data: { accessToken }, statusCode: 200 } as const;
};

export const logout = async (
  { blacklist }: AuthDeps,
  { refreshToken }: { refreshToken: string }
) => {
  const payload = await verifyToken(refreshToken).catch(() => null);
  if (payload?.jti) {
    await blacklist.add({ jti: payload.jti, userId: payload.sub, expiredAt: payload.exp!, ttl: payload.exp! });
  }
  return { data: { message: 'logged out' }, statusCode: 200 } as const;
};
