import { v4 as uuidv4 } from 'uuid';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { User } from '../../domain/user/User';
import { ITokenBlacklistRepository } from '../../domain/auth/ITokenBlacklistRepository';
import { Result, ok, err } from '../../domain/shared/Result';
import { signTokens, verifyToken } from '../../infrastructure/auth/JwtService';
import { hashPassword, comparePassword } from '../../infrastructure/auth/PasswordService';
import { UserId } from '../../domain/shared/types';

type AuthTokens = { accessToken: string; refreshToken: string; userId: UserId; isAnonymous: boolean };

export class AuthApplicationService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly blacklist: ITokenBlacklistRepository,
  ) {}

  async anonymousLogin(userId: UserId): Promise<Result<AuthTokens>> {
    let user = await this.userRepo.findById(userId);
    if (user?.deleted) return err('Account deleted', 401);
    if (!user) {
      const now = new Date().toISOString();
      user = {
        userId, isAnonymous: true, displayName: '',
        lifestyle: 'moderate', aiTone: 'friendly', timezone: 'Asia/Tokyo', createdAt: now,
      };
      await this.userRepo.create(user);
    }
    const tokens = await signTokens(userId);
    return ok({ ...tokens, userId, isAnonymous: user.isAnonymous });
  }

  async upgradeAccount(userId: UserId, email: string, password: string): Promise<Result<AuthTokens>> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing && existing.userId !== userId) return err('Email already registered', 409);
    const passwordHash = await hashPassword(password);
    await this.userRepo.upgradeToRegistered(userId, email, passwordHash);
    await this.userRepo.createEmailIndex(email, userId);
    const tokens = await signTokens(userId);
    return ok({ ...tokens, userId, isAnonymous: false });
  }

  async register(email: string, password: string, displayName?: string): Promise<Result<AuthTokens>> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) return err('Email already registered', 409);

    const userId = uuidv4() as UserId;
    const now = new Date().toISOString();
    const user: User = {
      userId, email, isAnonymous: false,
      displayName: displayName ?? '',
      passwordHash: await hashPassword(password),
      lifestyle: 'moderate', aiTone: 'friendly', timezone: 'Asia/Tokyo', createdAt: now,
    };
    await Promise.all([
      this.userRepo.create(user),
      this.userRepo.createEmailIndex(email, userId),
    ]);
    const tokens = await signTokens(userId);
    return ok({ ...tokens, userId, isAnonymous: false });
  }

  async login(email: string, password: string): Promise<Result<AuthTokens>> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
      return err('Invalid credentials', 401);
    }
    if (user.deleted) return err('Invalid credentials', 401);
    const tokens = await signTokens(user.userId);
    return ok({ ...tokens, userId: user.userId, isAnonymous: false });
  }

  async refresh(refreshToken: string): Promise<Result<{ accessToken: string }>> {
    const payload = await verifyToken(refreshToken).catch(() => null);
    if (!payload) return err('Invalid or expired token', 401);
    if (payload.jti && await this.blacklist.isBlacklisted(payload.jti)) {
      return err('Token revoked', 401);
    }
    const user = await this.userRepo.findById(payload.sub);
    if (user?.deleted) return err('Account deleted', 401);
    const { accessToken } = await signTokens(payload.sub);
    return ok({ accessToken });
  }

  async logout(refreshToken: string): Promise<Result<{ message: string }>> {
    const payload = await verifyToken(refreshToken).catch(() => null);
    if (payload?.jti) {
      await this.blacklist.add({ jti: payload.jti, userId: payload.sub, expiredAt: payload.exp!, ttl: payload.exp! });
    }
    return ok({ message: 'logged out' });
  }
}
