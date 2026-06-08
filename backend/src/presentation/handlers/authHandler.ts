import { LambdaEvent, ok, error, parseBody, toResponse } from '../http';
import { deps } from '../container';
import * as AuthUseCases from '../../application/auth/AuthUseCases';

const authDeps = { userRepo: deps.userRepo, blacklist: deps.blacklist };

export const handler = async (event: LambdaEvent) => {
  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  try {
    if (path === '/auth/register' && httpMethod === 'POST') {
      const { email, password, displayName } = body as { email: string; password: string; displayName?: string };
      if (!email || !password) return error('email and password required');
      return toResponse(await AuthUseCases.register(authDeps, { email, password, displayName }));
    }
    if (path === '/auth/login' && httpMethod === 'POST') {
      const { email, password } = body as { email: string; password: string };
      if (!email || !password) return error('email and password required');
      return toResponse(await AuthUseCases.login(authDeps, { email, password }));
    }
    if (path === '/auth/refresh' && httpMethod === 'POST') {
      const { refreshToken } = body as { refreshToken: string };
      if (!refreshToken) return error('refreshToken required');
      return toResponse(await AuthUseCases.refresh(authDeps, { refreshToken }));
    }
    if (path === '/auth/logout' && httpMethod === 'POST') {
      const { refreshToken } = body as { refreshToken: string };
      if (!refreshToken) return error('refreshToken required');
      return toResponse(await AuthUseCases.logout(authDeps, { refreshToken }));
    }
    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
