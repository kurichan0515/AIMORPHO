import { UserRepository } from '../../infrastructure/dynamodb/UserRepository';
import { NotificationApplicationService } from '../../application/notification/NotificationApplicationService';

const userRepo = new UserRepository();
const notifySvc = new NotificationApplicationService(userRepo);

// EventBridge cron から呼ばれる（毎日 20:00 JST = UTC 11:00）
export const handler = async (): Promise<void> => {
  try {
    const result = await notifySvc.sendDailyReminders();
    console.log(`Daily reminder: sent=${result.sent}, skipped=${result.skipped}`);
  } catch (err) {
    console.error('Daily reminder failed:', err);
    throw err;
  }
};
