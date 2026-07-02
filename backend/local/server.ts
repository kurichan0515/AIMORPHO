import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import express, { Request, Response, NextFunction } from 'express';
import { wrap } from './lambda-adapter';
import { verifyToken } from '../src/infrastructure/auth/JwtService';
import { handler as fnAuth }   from '../functions/fn-auth/index';
import { handler as fnUser }   from '../functions/fn-user/index';
import { handler as fnLog }    from '../functions/fn-log/index';
import { handler as fnMeal }   from '../functions/fn-meal/index';
import { handler as fnAvatar } from '../functions/fn-avatar/index';
import { handler as fnSocial } from '../functions/fn-social/index';
import { handler as fnAi }     from '../functions/fn-ai/index';
import { handler as fnAdmin }        from '../src/presentation/handlers/adminHandler';
import { handler as fnLegal }        from '../src/presentation/handlers/legalHandler';
import { handler as fnSubscription } from '../functions/fn-subscription/index';

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  if (_req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

type AuthRequest = Request & { userId?: string };

const auth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = await verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.post('/auth/anonymous', wrap(fnAuth as Parameters<typeof wrap>[0]));
app.post('/auth/upgrade',  auth, wrap(fnAuth as Parameters<typeof wrap>[0]));
app.post('/auth/register', wrap(fnAuth as Parameters<typeof wrap>[0]));
app.post('/auth/login',    wrap(fnAuth as Parameters<typeof wrap>[0]));
app.post('/auth/refresh',  wrap(fnAuth as Parameters<typeof wrap>[0]));
app.post('/auth/logout',   wrap(fnAuth as Parameters<typeof wrap>[0]));

app.get ('/users/me',              auth, wrap(fnUser as Parameters<typeof wrap>[0]));
app.put ('/users/me',              auth, wrap(fnUser as Parameters<typeof wrap>[0]));
app.put ('/users/me/fcm-token',    auth, wrap(fnUser as Parameters<typeof wrap>[0]));
app.get ('/users/me/goal',         auth, wrap(fnUser as Parameters<typeof wrap>[0]));
app.post('/users/me/goal',         auth, wrap(fnUser as Parameters<typeof wrap>[0]));
app.get ('/users/me/streak',       auth, wrap(fnUser as Parameters<typeof wrap>[0]));
app.get ('/users/me/badges',       auth, wrap(fnUser as Parameters<typeof wrap>[0]));
app.get ('/badges/stats',          auth, wrap(fnUser as Parameters<typeof wrap>[0]));

app.get ('/avatar',            auth, wrap(fnAvatar as Parameters<typeof wrap>[0]));
app.get ('/avatar/upload-url', auth, wrap(fnAvatar as Parameters<typeof wrap>[0]));
app.post('/avatar/generate',   auth, wrap(fnAvatar as Parameters<typeof wrap>[0]));
app.put ('/avatar/state',      auth, wrap(fnAvatar as Parameters<typeof wrap>[0]));

app.post('/logs/weight',          auth, wrap(fnLog as Parameters<typeof wrap>[0]));
app.get ('/logs/weight',          auth, wrap(fnLog as Parameters<typeof wrap>[0]));
app.get ('/logs/meal/upload-url', auth, wrap(fnMeal as Parameters<typeof wrap>[0]));
app.post('/logs/meal/manual',     auth, wrap(fnMeal as Parameters<typeof wrap>[0]));
app.post('/logs/meal/confirm',    auth, wrap(fnMeal as Parameters<typeof wrap>[0]));
app.post('/logs/meal',            auth, wrap(fnMeal as Parameters<typeof wrap>[0]));
app.get ('/logs/meal',            auth, wrap(fnMeal as Parameters<typeof wrap>[0]));
app.post('/logs/exercise',        auth, wrap(fnLog as Parameters<typeof wrap>[0]));
app.get ('/logs/exercise',        auth, wrap(fnLog as Parameters<typeof wrap>[0]));

app.get ('/ai/usage',              auth, wrap(fnAi as Parameters<typeof wrap>[0]));
app.post('/ai/reward-token',       auth, wrap(fnAi as Parameters<typeof wrap>[0]));
app.get ('/ai/daily-advice',       auth, wrap(fnAi as Parameters<typeof wrap>[0]));
app.post('/ai/penalty-event',      auth, wrap(fnAi as Parameters<typeof wrap>[0]));
app.get ('/ai/goal-message',       auth, wrap(fnAi as Parameters<typeof wrap>[0]));
app.post('/ai/meal-suggestion',    auth, wrap(fnAi as Parameters<typeof wrap>[0]));
app.post('/ai/exercise-suggestion',auth, wrap(fnAi as Parameters<typeof wrap>[0]));
app.get ('/webhooks/admob-reward',      wrap(fnAi as Parameters<typeof wrap>[0])); // AdMob SSV: no auth

app.post  ('/groups',                auth, wrap(fnSocial as Parameters<typeof wrap>[0]));
app.post  ('/groups/join',           auth, wrap(fnSocial as Parameters<typeof wrap>[0]));
app.get   ('/groups/me',             auth, wrap(fnSocial as Parameters<typeof wrap>[0]));
app.get   ('/groups/:group_id',      auth, wrap(fnSocial as Parameters<typeof wrap>[0]));
app.get   ('/groups/:group_id/feed', auth, wrap(fnSocial as Parameters<typeof wrap>[0]));
app.delete('/groups/:group_id/leave',auth, wrap(fnSocial as Parameters<typeof wrap>[0]));

app.delete('/users/me', auth, wrap(fnUser as Parameters<typeof wrap>[0]));
app.post('/inquiries',  auth, wrap(fnUser as Parameters<typeof wrap>[0]));

app.get ('/admin/inquiries',        wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.patch('/admin/inquiries/status', wrap(fnAdmin as Parameters<typeof wrap>[0]));

app.post('/admin/login',                         wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.post('/admin/notifications/send',            wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.get ('/admin/users',                         wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.get ('/admin/stats',                         wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.get ('/admin/users/:userId',                 wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.get ('/admin/users/:userId/logs',            wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.post('/admin/users/:userId/restore',         wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.get ('/admin/trophies',                  wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.get ('/admin/legal',                     wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.get ('/admin/legal/upload-url',          wrap(fnAdmin as Parameters<typeof wrap>[0]));
app.post('/admin/legal/activate',            wrap(fnAdmin as Parameters<typeof wrap>[0]));

app.get('/legal/terms',   wrap(fnLegal as Parameters<typeof wrap>[0]));
app.get('/legal/privacy', wrap(fnLegal as Parameters<typeof wrap>[0]));

app.post('/subscriptions/verify/apple',   auth, wrap(fnSubscription as Parameters<typeof wrap>[0]));
app.post('/subscriptions/verify/google',  auth, wrap(fnSubscription as Parameters<typeof wrap>[0]));
app.post('/subscriptions/webhook/apple',  wrap(fnSubscription as Parameters<typeof wrap>[0]));
app.post('/subscriptions/webhook/google', wrap(fnSubscription as Parameters<typeof wrap>[0]));

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`AIMORPHO local API: http://localhost:${PORT}`);
  console.log(`DynamoDB endpoint: ${process.env.DYNAMODB_ENDPOINT ?? '(AWS)'}`);
  console.log(`Gemini API:        ${process.env.GEMINI_API_KEY ? 'enabled' : 'mock mode'}`);
});
