import * as jwt from 'jsonwebtoken';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' });

type AppleSecrets = { keyId: string; issuerId: string; privateKey: string; bundleId: string };
let _secrets: AppleSecrets | null = null;

const getSecrets = async (): Promise<AppleSecrets> => {
  if (_secrets) return _secrets;
  if (process.env.APPLE_KEY_ID) {
    _secrets = {
      keyId:      process.env.APPLE_KEY_ID!,
      issuerId:   process.env.APPLE_ISSUER_ID!,
      privateKey: process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      bundleId:   process.env.APPLE_BUNDLE_ID!,
    };
    return _secrets;
  }
  const r = await sm.send(new GetSecretValueCommand({ SecretId: 'aimorpho/apple-iap' }));
  const s = JSON.parse(r.SecretString!);
  _secrets = {
    keyId:      s.APPLE_KEY_ID,
    issuerId:   s.APPLE_ISSUER_ID,
    privateKey: s.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    bundleId:   s.APPLE_BUNDLE_ID,
  };
  return _secrets;
};

const APPLE_API_BASE        = 'https://api.storekit.itunes.apple.com';
const APPLE_SANDBOX_API_BASE = 'https://api.storekit-sandbox.itunes.apple.com';

async function buildClientSecret(): Promise<string> {
  const { keyId, issuerId, privateKey } = await getSecrets();
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId, typ: 'JWT' },
    issuer: issuerId,
    audience: 'appstoreconnect-v1',
    expiresIn: '10m',
  });
}

export type AppleVerifyResult =
  | { ok: true; productId: string; expiresAt: string; transactionId: string; environment: string }
  | { ok: false; reason: string };

export async function verifyAppleTransaction(transactionId: string): Promise<AppleVerifyResult> {
  const { bundleId } = await getSecrets();
  const token = await buildClientSecret();
  const isProd = process.env.NODE_ENV === 'production';
  const base = isProd ? APPLE_API_BASE : APPLE_SANDBOX_API_BASE;

  const res = await fetch(`${base}/inApps/v1/subscriptions/${transactionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false, reason: `Apple API ${res.status}` };

  const data = await res.json() as any;
  const signedTransaction = data.data?.[0]?.lastTransactions?.[0]?.signedTransactionInfo;
  if (!signedTransaction) return { ok: false, reason: 'no transaction found' };

  const decoded = jwt.decode(signedTransaction, { complete: true })?.payload as any;
  if (!decoded) return { ok: false, reason: 'decode failed' };
  if (decoded.bundleId !== bundleId) return { ok: false, reason: 'bundle id mismatch' };

  const expiresMs = decoded.expiresDate as number;
  if (Date.now() > expiresMs) return { ok: false, reason: 'subscription expired' };

  return {
    ok: true,
    productId: decoded.productId,
    expiresAt: new Date(expiresMs).toISOString(),
    transactionId: decoded.transactionId,
    environment: decoded.environment,
  };
}

export type AppleWebhookPayload = { signedPayload: string };

export function decodeAppleWebhook(payload: AppleWebhookPayload): any {
  return jwt.decode(payload.signedPayload, { complete: true })?.payload ?? null;
}
