import crypto from 'crypto';

const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type AdmobKey = { keyId: number; pem: string };
let cachedKeys: Map<number, AdmobKey> | null = null;
let cacheExpiresAt = 0;

async function fetchKeys(): Promise<Map<number, AdmobKey>> {
  if (cachedKeys && Date.now() < cacheExpiresAt) { return cachedKeys; }
  const res = await fetch(KEYS_URL);
  const json = await res.json() as { keys: { keyId: number; pem: string }[] };
  cachedKeys = new Map(json.keys.map(k => [k.keyId, k]));
  cacheExpiresAt = Date.now() + KEY_CACHE_TTL_MS;
  return cachedKeys;
}

// AdMob SSV コールバックのクエリパラメータを検証する。
// Google は ECDSA-P256-SHA256 で署名し、base64url エンコードした signature を付与する。
// 検証メッセージ: signature 以外の全クエリパラメータをキー名ソートして "&" で連結した文字列。
export async function verifyAdmobSsvQuery(query: Record<string, string>): Promise<boolean> {
  const { signature, key_id, ...rest } = query;
  if (!signature || !key_id) { return false; }

  const message = Object.entries(rest)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const keyId = parseInt(key_id, 10);
  const keys = await fetchKeys();
  const key = keys.get(keyId);
  if (!key) { return false; }

  try {
    const publicKey = crypto.createPublicKey({ key: key.pem, format: 'pem' });
    return crypto.verify(
      'SHA256',
      Buffer.from(message, 'utf8'),
      publicKey,
      Buffer.from(signature, 'base64url'),
    );
  } catch {
    return false;
  }
}
