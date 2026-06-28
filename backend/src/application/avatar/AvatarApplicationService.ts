import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { IGoalRepository } from '../../domain/user/IGoalRepository';
import { IStorageService } from '../../domain/storage/IStorageService';
import { IAiService } from '../../domain/ai/IAiService';
import { isPremium } from '../../domain/user/User';
import { Avatar } from '../../domain/avatar/Avatar';
import { Result, ok, err } from '../../domain/shared/Result';
import { UserId, GoalMode } from '../../domain/shared/types';

const BODY_DESCRIPTIONS: Record<GoalMode, string[]> = {
  diet: [
    '引き締まった細身の体型（理想・目標達成）',
    '少しスリムな体型（もう少し）',
    '標準的な体型',
    '少し太めの体型（要ケア）',
    'ぽっちゃりした体型（目標から遠い）',
  ],
  bulk: [
    '筋肉質でがっしりした体型（理想・目標達成）',
    '少し筋肉がついた体型（もう少し）',
    '標準的な体型',
    'やや細身の体型（要ケア）',
    '非常に細身な体型（目標から遠い）',
  ],
  maintain: [
    'バランスよく引き締まった体型（理想維持）',
    'やや引き締まった体型（良好）',
    '標準的な体型（現状維持）',
    'やや変化が見られる体型（要注意）',
    'バランスを崩した体型（要ケア）',
  ],
};

const MAX_AVATAR_GENERATES = 2;

export class AvatarApplicationService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly goalRepo: IGoalRepository,
    private readonly avatarRepo: IAvatarRepository,
    private readonly storageSvc: IStorageService,
    private readonly aiSvc: IAiService,
  ) {}

  async getAvatar(userId: UserId): Promise<Result<unknown>> {
    const avatar = await this.avatarRepo.get(userId);
    return ok(avatar ?? null);
  }

  async getAvatarUploadUrl(userId: UserId): Promise<Result<{ uploadUrl: string; s3Key: string }>> {
    const key = `faces/${userId}/${Date.now()}.jpg`;
    const uploadUrl = await this.storageSvc.getAvatarUploadUrl(key);
    return ok({ uploadUrl, s3Key: key });
  }

  async generateAvatar(userId: UserId, facePhotoKey: string): Promise<Result<unknown>> {
    const [current, user] = await Promise.all([
      this.avatarRepo.get(userId),
      this.userRepo.findById(userId),
    ]);
    if (!isPremium(user!) && (current?.regenerateCount ?? 0) >= MAX_AVATAR_GENERATES) {
      return err('limit_reached', 403);
    }

    const goal = await this.goalRepo.getGoal(userId);
    const mode: GoalMode = goal?.mode ?? 'maintain';
    const descriptions = BODY_DESCRIPTIONS[mode];

    const base64Face = await this.storageSvc.getObjectBase64(facePhotoKey);
    const avatarImages: Partial<Record<number, string | null>> = {};
    const errors: Array<{ state: number; error: string }> = [];

    for (let i = 0; i < 5; i++) {
      try {
        const result = await this.aiSvc.generateAvatarImage(base64Face, descriptions[i]);
        const key = `avatars/${userId}/state_${i}.png`;
        await this.storageSvc.putObject(key, Buffer.from(result.image_base64, 'base64'), result.mime_type ?? 'image/png');
        avatarImages[i] = this.storageSvc.publicUrl(key);
      } catch (e) {
        errors.push({ state: i, error: (e as Error).message });
        avatarImages[i] = null;
      }
    }

    const now = new Date().toISOString();
    const avatar: Avatar = {
      userId,
      facePhotoKey,
      avatarImages,
      bodyState: current?.bodyState ?? 0,
      missedDays: current?.missedDays ?? 0,
      bodyBalance: current?.bodyBalance,
      regenerateCount: (current?.regenerateCount ?? 0) + 1,
      updatedAt: now,
    };
    await this.avatarRepo.save(avatar);

    return ok({ avatarImages, errors: errors.length ? errors : undefined });
  }

  async updateAvatarState(userId: UserId, bodyState: number): Promise<Result<unknown>> {
    if (bodyState < 0 || bodyState > 4) return err('bodyState must be 0-4', 400);
    const updated = await this.avatarRepo.updateBodyState(userId, bodyState, new Date().toISOString());
    return ok(updated);
  }
}
