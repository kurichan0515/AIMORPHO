import { LambdaEvent, error, parseBody, ok } from '../http';
import { userSvc, storageSvc, inquiryRepo, userRepo, avatarRepo, bodyLogRepo, mealRepo, badgeRepo } from '../container';
import { BADGE_DEFINITIONS } from '../../domain/badge/Badge';
import { buildTrophyStats } from '../../infrastructure/dynamodb/BadgeRepository';
import { sendPushNotification } from '../../infrastructure/fcm/FcmService';
import { LegalRepository, LegalFile } from '../../infrastructure/dynamodb/LegalRepository';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, BUCKET } from '../../infrastructure/s3/S3Client';
import { verifyToken, signAdminToken } from '../../infrastructure/auth/JwtService';
import bcrypt from 'bcryptjs';

const legalRepo = new LegalRepository();

const ADMIN_USERNAME     = process.env.ADMIN_USERNAME ?? '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? '';

const verifyAdmin = async (event: LambdaEvent): Promise<boolean> => {
  const auth = event.headers?.['authorization'] ?? event.headers?.['Authorization'] ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  try {
    const payload = await verifyToken(auth.slice(7));
    return (payload as any).role === 'admin';
  } catch {
    return false;
  }
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
  const { httpMethod, path } = event;
  const body = parseBody(event.body);

  if (path === '/admin/login' && httpMethod === 'POST') {
    const { username, password } = body as { username?: string; password?: string };
    if (!username || !password) return error('username and password required');
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) return error('Admin auth not configured', 500);
    if (username !== ADMIN_USERNAME) return error('Invalid credentials', 401);
    const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!valid) return error('Invalid credentials', 401);
    const token = await signAdminToken();
    return ok({ token });
  }

  if (!await verifyAdmin(event)) return error('Forbidden', 403);

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
      const users = await userRepo.listAllUsers();
      return ok({ count: users.length, users });
    }

    if (path === '/admin/stats' && httpMethod === 'GET') {
      const users = await userRepo.listAllUsers();
      const activeUsers = users.filter(u => !u.deleted);
      // 日別新規登録（直近60日）
      const registrationsByDay: Record<string, number> = {};
      const premiumByDay: Record<string, number> = {};
      for (const u of activeUsers) {
        if (!u.createdAt) continue;
        const day = u.createdAt.slice(0, 10);
        registrationsByDay[day] = (registrationsByDay[day] ?? 0) + 1;
        if (u.subscriptionTier === 'premium') {
          premiumByDay[day] = (premiumByDay[day] ?? 0) + 1;
        }
      }
      const today = new Date();
      const days: string[] = [];
      for (let i = 59; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
      }
      const trend = days.map(day => ({
        date: day,
        registrations: registrationsByDay[day] ?? 0,
        premiumSignups: premiumByDay[day] ?? 0,
      }));
      // 累計サブスク
      const premiumTotal = activeUsers.filter(u => u.subscriptionTier === 'premium').length;
      return ok({ trend, premiumTotal, total: activeUsers.length });
    }

    const userDetailMatch = path.match(/^\/admin\/users\/([^\/]+)$/);
    if (userDetailMatch && httpMethod === 'GET') {
      const userId = userDetailMatch[1] as never;
      const [user, avatar] = await Promise.all([
        userRepo.findById(userId),
        avatarRepo.get(userId),
      ]);
      if (!user) return error('User not found', 404);

      let avatarImageUrls: Record<string, string> = {};
      let facePhotoUrl: string | null = null;
      if (avatar) {
        const signUrl = (key: string) =>
          getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
        if (avatar.facePhotoKey) facePhotoUrl = await signUrl(avatar.facePhotoKey);
        const entries = Object.entries(avatar.avatarImages) as [string, string | null][];
        for (const [k, v] of entries) {
          if (v) avatarImageUrls[k] = await signUrl(v);
        }
      }

      return ok({
        user,
        avatar: avatar ? {
          bodyState: avatar.bodyState,
          missedDays: avatar.missedDays,
          bodyBalance: avatar.bodyBalance,
          regenerateCount: avatar.regenerateCount,
          updatedAt: avatar.updatedAt,
          facePhotoUrl,
          avatarImageUrls,
        } : null,
      });
    }

    const userRestoreMatch = path.match(/^\/admin\/users\/([^\/]+)\/restore$/);
    if (userRestoreMatch && httpMethod === 'POST') {
      const userId = userRestoreMatch[1] as never;
      await userRepo.restoreAccount(userId);
      return ok({ ok: true });
    }

    const userLogsMatch = path.match(/^\/admin\/users\/([^\/]+)\/logs$/);
    if (userLogsMatch && httpMethod === 'GET') {
      const userId = userLogsMatch[1] as never;
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const [weightResult, exerciseResult, mealResult] = await Promise.all([
        bodyLogRepo.getWeightHistory(userId, from, to, 100),
        bodyLogRepo.getExerciseHistory(userId, from, to, 100),
        mealRepo.getHistory(userId, from, to, 100),
      ]);
      return ok({
        weightLogs: weightResult.items,
        exerciseLogs: exerciseResult.items,
        mealLogs: mealResult.items.map(m => ({
          kcal: m.kcal, proteinG: m.proteinG, fatG: m.fatG, carbG: m.carbG,
          menuName: m.menuName, recordedAt: m.recordedAt,
        })),
      });
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

    if (path === '/admin/trophies' && httpMethod === 'GET') {
      const [users, acquisitionStats] = await Promise.all([
        userRepo.listAllUsers(),
        badgeRepo.getAcquisitionStats(),
      ]);
      const totalUsers = users.filter(u => !u.deleted).length;
      const statsById = new Map(buildTrophyStats(acquisitionStats, totalUsers).map(s => [s.badgeId, s]));
      const trophies = BADGE_DEFINITIONS.map(def => ({
        ...statsById.get(def.id)!,
        name: def.name,
        description: def.description,
        threshold: def.threshold,
      }));
      return ok({ totalUsers, trophies });
    }

    return error('Not found', 404);
  } catch (err) {
    console.error(err);
    return error('Internal server error', 500);
  }
};
