import { LambdaEvent, error, parseBody, ok } from '../http';
import { userSvc, storageSvc } from '../container';
import { sendPushNotification } from '../../infrastructure/fcm/FcmService';
import { LegalRepository, LegalFile } from '../../infrastructure/dynamodb/LegalRepository';

const legalRepo = new LegalRepository();

const ADMIN_KEY = process.env.ADMIN_API_KEY ?? '';

const verifyAdmin = (event: LambdaEvent): boolean => {
  const key = event.headers?.['x-admin-key'] ?? event.headers?.['X-Admin-Key'];
  return !!ADMIN_KEY && key === ADMIN_KEY;
};

export const handler = async (event: LambdaEvent) => {
  if (!verifyAdmin(event)) return error('Forbidden', 403);

  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/admin/notifications/send' && httpMethod === 'POST') {
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

    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
