import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createSign } from 'crypto';

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' });

type GoogleSecrets = { serviceAccountJson: string; packageName: string };
let _secrets: GoogleSecrets | null = null;

const getSecrets = async (): Promise<GoogleSecrets> => {
  if (_secrets) return _secrets;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    _secrets = {
      serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON!,
      packageName:        process.env.GOOGLE_PACKAGE_NAME!,
    };
    return _secrets;
  }
  const r = await sm.send(new GetSecretValueCommand({ SecretId: 'aimorpho/google-play' }));
  const s = JSON.parse(r.SecretString!);
  _secrets = {
    serviceAccountJson: s.GOOGLE_SERVICE_ACCOUNT_JSON,
    packageName:        s.GOOGLE_PACKAGE_NAME,
  };
  return _secrets;
};

async function getAccessToken(): Promise<string> {
  const { serviceAccountJson } = await getSecrets();
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })).toString('base64url');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${claims}`);
  const signature = sign.sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const data = await res.json() as any;
  return data.access_token as string;
}

export type GoogleVerifyResult =
  | { ok: true; productId: string; expiresAt: string; orderId: string }
  | { ok: false; reason: string };

export async function verifyGooglePurchase(
  productId: string,
  purchaseToken: string
): Promise<GoogleVerifyResult> {
  const { packageName } = await getSecrets();
  const accessToken = await getAccessToken();

  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { ok: false, reason: `Google API ${res.status}` };

  const data = await res.json() as any;
  const lineItem = data.lineItems?.[0];
  if (!lineItem) return { ok: false, reason: 'no line item' };

  const expiresMs = Number(lineItem.expiryTime);
  if (Date.now() > expiresMs) return { ok: false, reason: 'subscription expired' };

  return {
    ok: true,
    productId: lineItem.productId ?? productId,
    expiresAt: new Date(expiresMs).toISOString(),
    orderId:   data.latestOrderId ?? '',
  };
}
