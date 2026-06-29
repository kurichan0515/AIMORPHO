import { IUserRepository } from '../../domain/user/IUserRepository';
import { IGoalRepository } from '../../domain/user/IGoalRepository';
import { IStreakRepository } from '../../domain/user/IStreakRepository';
import { IBadgeRepository } from '../../domain/badge/IBadgeRepository';
import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { IMealRepository } from '../../domain/meal/IMealRepository';
import { IBodyLogRepository } from '../../domain/body-log/IBodyLogRepository';
import { UpdateProfileInput, isPremium } from '../../domain/user/User';
import { Goal } from '../../domain/user/Goal';
import { emptyStreak } from '../../domain/user/Streak';
import { FREE_AI_TONES } from '../../domain/usage/UsageLimits';
import { Result, ok, err } from '../../domain/shared/Result';
import { UserId, GoalMode } from '../../domain/shared/types';

export class UserApplicationService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly goalRepo: IGoalRepository,
    private readonly streakRepo: IStreakRepository,
    private readonly badgeRepo: IBadgeRepository,
    private readonly avatarRepo: IAvatarRepository,
    private readonly mealRepo: IMealRepository,
    private readonly bodyLogRepo: IBodyLogRepository,
  ) {}

  async getProfile(userId: UserId): Promise<Result<unknown>> {
    const user = await this.userRepo.findById(userId);
    if (!user) return err('User not found', 404);
    const { passwordHash, ...profile } = user;
    return ok(profile);
  }

  async updateProfile(userId: UserId, input: UpdateProfileInput): Promise<Result<unknown>> {
    if (!Object.keys(input).length) return err('No valid fields to update', 400);
    if (input.aiTone) {
      const user = await this.userRepo.findById(userId);
      if (user && !isPremium(user) && !FREE_AI_TONES.includes(input.aiTone)) {
        return err('AI tone requires premium', 403);
      }
    }
    const updated = await this.userRepo.updateProfile(userId, input);
    const { passwordHash, ...profile } = updated;
    return ok(profile);
  }

  async getGoal(userId: UserId): Promise<Result<Goal>> {
    const goal = await this.goalRepo.getGoal(userId);
    if (!goal) return err('No active goal', 404);
    return ok(goal);
  }

  async upsertGoal(userId: UserId, targetWeight: number, mode: GoalMode): Promise<Result<Goal>> {
    const goal: Goal = { userId, targetWeight, mode, startedAt: new Date().toISOString() };
    await this.goalRepo.upsertGoal(goal);
    return ok(goal);
  }

  async getStreak(userId: UserId): Promise<Result<unknown>> {
    const streak = await this.streakRepo.getStreak(userId) ?? emptyStreak(userId);
    return ok(streak);
  }

  async saveFcmToken(userId: UserId, fcmToken: string): Promise<Result<{ ok: boolean }>> {
    await this.userRepo.saveFcmToken(userId, fcmToken);
    return ok({ ok: true });
  }

  async getBadges(userId: UserId): Promise<Result<unknown>> {
    const badges = await this.badgeRepo.listByUser(userId);
    return ok(badges);
  }

  async getProgress(userId: UserId): Promise<Result<unknown>> {
    const [streak, mealCount, exerciseCount] = await Promise.all([
      this.streakRepo.getStreak(userId),
      this.mealRepo.count(userId),
      this.bodyLogRepo.countExercise(userId),
    ]);
    return ok({
      streakDays:        streak?.currentDays   ?? 0,
      longestStreakDays: streak?.longestDays    ?? 0,
      mealCount,
      exerciseCount,
    });
  }

  // 論理削除: 全 DynamoDB アイテムに TTL 30日をセット（自動消去）
  // S3アバター画像は復活期間中（30日）に復帰できるよう保持。復活期限後の S3 掃除は
  // S3 ライフサイクルルール or 別バッチで実施すること。
  async deleteAccount(userId: UserId): Promise<Result<{ message: string }>> {
    await this.userRepo.deleteAccount(userId);
    return ok({ message: 'account deleted' });
  }

  async listAllFcmTokens(): Promise<{ userId: UserId; fcmToken: string }[]> {
    return this.userRepo.listAllFcmTokens();
  }

  async findById(userId: UserId) {
    return this.userRepo.findById(userId);
  }
}
