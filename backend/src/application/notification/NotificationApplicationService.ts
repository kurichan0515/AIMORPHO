import { IUserRepository } from '../../domain/user/IUserRepository';
import { sendPushNotification } from '../../infrastructure/fcm/FcmService';
import { toJSTDate } from '../../infrastructure/dynamodb/client';

export class NotificationApplicationService {
  constructor(private readonly userRepo: IUserRepository) {}

  async sendDailyReminders(): Promise<{ sent: number; skipped: number }> {
    const todayJST = toJSTDate(new Date().toISOString());

    const users = await this.userRepo.listFcmTokensWithStreak();

    const targets = users.filter(u => {
      if (u.notificationsEnabled === false) return false; // 通知オフ
      if (!u.lastLoggedAt) return true; // 一度も記録していない
      return toJSTDate(u.lastLoggedAt) !== todayJST;
    });

    if (!targets.length) return { sent: 0, skipped: users.length };

    const tokens = targets.map(u => u.fcmToken);
    const result = await sendPushNotification({
      tokens,
      title: '今日の記録はしましたか？ 🔥',
      body: '記録を続けてストリークを維持しよう！',
      data: { screen: 'Log' },
    });

    return { sent: result.sent, skipped: users.length - targets.length };
  }
}
