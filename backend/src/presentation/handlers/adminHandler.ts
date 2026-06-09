import { LambdaEvent, error, parseBody, toResponse } from '../http';
import { deps } from '../container';
import { sendPushNotification } from '../../infrastructure/fcm/FcmService';

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
        title: string;
        body: string;
        screen?: string;
        userIds?: string[];
      };
      if (!title || !msgBody) return error('title and body required');

      let tokens: string[];
      if (userIds?.length) {
        const users = await Promise.all(userIds.map(uid => deps.userRepo.findById(uid)));
        tokens = users.flatMap(u => (u?.fcmToken ? [u.fcmToken] : []));
      } else {
        const all = await deps.userRepo.listAllFcmTokens();
        tokens = all.map(u => u.fcmToken);
      }

      if (!tokens.length) return toResponse({ data: { sent: 0, message: 'no tokens' }, statusCode: 200 });

      const result = await sendPushNotification({ tokens, title, body: msgBody, data: screen ? { screen } : undefined });
      return toResponse({ data: result, statusCode: 200 });
    }

    if (path === '/admin/users' && httpMethod === 'GET') {
      const tokens = await deps.userRepo.listAllFcmTokens();
      return toResponse({ data: { count: tokens.length, users: tokens.map(t => ({ userId: t.userId, hasFcm: !!t.fcmToken })) }, statusCode: 200 });
    }

    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
