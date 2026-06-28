export type TokenBlacklist = {
  jti: string;
  userId: string;
  expiredAt: number;
  ttl: number;
};

export interface ITokenBlacklistRepository {
  isBlacklisted(jti: string): Promise<boolean>;
  add(entry: TokenBlacklist): Promise<void>;
}
