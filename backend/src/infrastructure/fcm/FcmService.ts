import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' });
let _serviceAccount: Record<string, unknown> | null = null;

const getServiceAccount = async () => {
  if (_serviceAccount) return _serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    _serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    return _serviceAccount;
  }
  try {
    const r = await sm.send(new GetSecretValueCommand({ SecretId: 'aimorpho/firebase-service-account' }));
    _serviceAccount = JSON.parse(r.SecretString!);
    return _serviceAccount;
  } catch { return null; }
};

let _accessToken: { token: string; expiresAt: number } | null = null;

const getAccessToken = async (): Promise<string | null> => {
  if (_accessToken && Date.now() < _accessToken.expiresAt - 60_000) return _accessToken.token;

  const sa = await getServiceAccount();
  if (!sa) return null;

  const { default: jwt } = await import('jsonwebtoken');
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email as string,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signed = jwt.sign(claim, sa.private_key as string, { algorithm: 'RS256' });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signed}`,
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token: string; expires_in: number };
  _accessToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return _accessToken.token;
};

export type SendResult = { sent: number; failed: number };

export const sendPushNotification = async ({
  tokens, title, body, data,
}: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<SendResult> => {
  const sa = await getServiceAccount();
  if (!sa) {
    console.warn('FCM: no service account configured, skipping send');
    return { sent: 0, failed: tokens.length };
  }

  const token = await getAccessToken();
  if (!token) return { sent: 0, failed: tokens.length };

  const projectId = sa.project_id as string;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const results = await Promise.allSettled(
    tokens.map(fcmToken =>
      fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            data: data ?? {},
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      }).then(r => { if (!r.ok) throw new Error(`FCM ${r.status}`); })
    )
  );

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  return { sent, failed };
};
