import { LambdaEvent, error, parseBody, ok } from '../http';
import { userSvc, storageSvc, inquiryRepo } from '../container';
import { sendPushNotification } from '../../infrastructure/fcm/FcmService';
import { LegalRepository, LegalFile } from '../../infrastructure/dynamodb/LegalRepository';

const legalRepo = new LegalRepository();

const ADMIN_KEY = process.env.ADMIN_API_KEY ?? '';

const verifyAdmin = (event: LambdaEvent): boolean => {
  const key = event.headers?.['x-admin-key'] ?? event.headers?.['X-Admin-Key'];
  return !!ADMIN_KEY && key === ADMIN_KEY;
};

// インスタンスローカルな簡易レートリミット（Lambda cold start でリセット）
// 本番では DynamoDB TTL ベースの実装を推奨
const _notifyCalls: number[] = [];
const NOTIFY_RATE_LIMIT = 10; // 1時間あたり最大10回
const NOTIFY_WINDOW_MS  = 60 * 60 * 1000;

const isNotifyRateLimited = (): boolean => {
  const now = Date.now();
  const recent = _notifyCalls.filter(t => now - t < NOTIFY_WINDOW_MS);
  _notifyCalls.length = 0;
  _notifyCalls.push(...recent);
  if (recent.length >= NOTIFY_RATE_LIMIT) return true;
  _notifyCalls.push(now);
  return false;
};

export const handler = async (event: LambdaEvent) => {
  if (!verifyAdmin(event)) return error('Forbidden', 403);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/admin/notifications/send' && httpMethod === 'POST') {
      if (isNotifyRateLimited()) return error('Rate limit exceeded: max 10 sends per hour', 429);
      const { title, body: msgBody, screen, userIds } = body as {
        title: string; body: string; screen?: string; userIds?: string[];
      };
      if (!title || !msgBody) return error('title and body required');

      let tokens: string[];
      if (userIds?.length) {
        const users = await Promise.all(userIds.map(uid => userSvc.findById(uid as never)));
        tokens = users.flatMap(u => (u?.fcmToken ? [u.fcmToken] : []));
      } else {
        const all = await userSvc.listAllFcmTokens();
        tokens = all.map(u => u.fcmToken);
      }

      if (!tokens.length) return ok({ sent: 0, message: 'no tokens' });

      const result = await sendPushNotification({ tokens, title, body: msgBody, data: screen ? { screen } : undefined });
      return ok(result);
    }

    if (path === '/admin/users' && httpMethod === 'GET') {
      const tokens = await userSvc.listAllFcmTokens();
      return ok({ count: tokens.length, users: tokens.map(t => ({ userId: t.userId, hasFcm: !!t.fcmToken })) });
    }

    if (path === '/admin/legal' && httpMethod === 'GET') {
      const [terms, privacy] = await Promise.all([legalRepo.get('terms'), legalRepo.get('privacy')]);
      return ok({ terms, privacy });
    }

    if (path === '/admin/legal/upload-url' && httpMethod === 'GET') {
      const file = event.queryStringParameters?.file as LegalFile | undefined;
      if (file !== 'terms' && file !== 'privacy') return error('file must be terms or privacy');
      const key = `legal/${file}/${Date.now()}.html`;
      const uploadUrl = await storageSvc.getLegalUploadUrl(key);
      return ok({ uploadUrl, key });
    }

    if (path === '/admin/legal/activate' && httpMethod === 'POST') {
      const { file, key } = body as { file: LegalFile; key: string };
      if (file !== 'terms' && file !== 'privacy') return error('file must be terms or privacy');
      if (!key) return error('key required');
      await legalRepo.activate(file, key);
      return ok({ ok: true });
    }

    if (path === '/admin/inquiries' && httpMethod === 'GET') {
      const qs = event.queryStringParameters ?? {};
      const limit = Math.min(200, Math.max(1, parseInt(qs.limit ?? '50', 10) || 50));
      const result = await inquiryRepo.list(limit, qs.cursor);
      return ok(result);
    }

    if (path === '/admin/inquiries/status' && httpMethod === 'PATCH') {
      const { inquiryId, status } = body as { inquiryId: string; status: string };
      if (!inquiryId || !status) return error('inquiryId and status required');
      await inquiryRepo.updateStatus(inquiryId, status as any);
      return ok({ ok: true });
    }

    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
