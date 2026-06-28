import { LambdaEvent, error, parseBody, getUserId, fromResult } from '../http';
import { authSvc } from '../container';

export const handler = async (event: LambdaEvent) => {
  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/auth/anonymous' && httpMethod === 'POST') {
      const { userId } = body as { userId?: string };
      if (!userId) return error('userId required');
      return fromResult(await authSvc.anonymousLogin(userId as never), 200);
    }
    if (path === '/auth/upgrade' && httpMethod === 'POST') {
      const userId = getUserId(event);
      if (!userId) return error('Unauthorized', 401);
      const { email, password } = body as { email?: string; password?: string };
      if (!email || !password) return error('email and password required');
      return fromResult(await authSvc.upgradeAccount(userId as never, email, password));
    }
    if (path === '/auth/register' && httpMethod === 'POST') {
      const { email, password, displayName } = body as { email?: string; password?: string; displayName?: string };
      if (!email || !password) return error('email and password required');
      return fromResult(await authSvc.register(email, password, displayName), 201);
    }
    if (path === '/auth/login' && httpMethod === 'POST') {
      const { email, password } = body as { email?: string; password?: string };
      if (!email || !password) return error('email and password required');
      return fromResult(await authSvc.login(email, password));
    }
    if (path === '/auth/refresh' && httpMethod === 'POST') {
      const { refreshToken } = body as { refreshToken?: string };
      if (!refreshToken) return error('refreshToken required');
      return fromResult(await authSvc.refresh(refreshToken));
    }
    if (path === '/auth/logout' && httpMethod === 'POST') {
      const { refreshToken } = body as { refreshToken?: string };
      if (!refreshToken) return error('refreshToken required');
      return fromResult(await authSvc.logout(refreshToken));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
