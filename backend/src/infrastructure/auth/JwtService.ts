import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' });
let _jwtSecret: string | null = null;

const getJwtSecret = async (): Promise<string> => {
  if (_jwtSecret) return _jwtSecret;
  if (process.env.JWT_SECRET) {
    _jwtSecret = process.env.JWT_SECRET;
    return _jwtSecret;
  }
  const r = await sm.send(new GetSecretValueCommand({ SecretId: 'yasrun/jwt-secret' }));
  _jwtSecret = JSON.parse(r.SecretString!).JWT_SECRET;
  return _jwtSecret!;
};

export type TokenPair = { accessToken: string; refreshToken: string; jti: string };
export type TokenPayload = { sub: string; jti?: string; exp?: number };

export const signTokens = async (userId: string): Promise<TokenPair> => {
  const secret = await getJwtSecret();
  const jti = crypto.randomUUID();
  const accessToken = jwt.sign({ sub: userId }, secret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ sub: userId, jti }, secret, { expiresIn: '30d' });
  return { accessToken, refreshToken, jti };
};

export const verifyToken = async (token: string): Promise<TokenPayload> => {
  const secret = await getJwtSecret();
  return jwt.verify(token, secret) as TokenPayload;
};
