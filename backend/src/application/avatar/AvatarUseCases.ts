import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { Avatar } from '../../domain/avatar/Avatar';
import { generateAvatarImage } from '../../infrastructure/gemini/GeminiClient';
import { getUploadUrl, getObjectBase64, putObject, publicUrl } from '../../infrastructure/s3/S3Client';
import { UserId, GoalMode } from '../../domain/shared/types';

type Deps = { avatarRepo: IAvatarRepository; userRepo: IUserRepository };

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

export const getAvatar = async (deps: Deps, userId: UserId) => {
  const avatar = await deps.avatarRepo.get(userId);
  return { data: avatar ?? null, statusCode: 200 } as const;
};

export const getAvatarUploadUrl = async (userId: UserId) => {
  const key = `faces/${userId}/${Date.now()}.jpg`;
  const uploadUrl = await getUploadUrl(key);
  return { data: { uploadUrl, s3Key: key }, statusCode: 200 } as const;
};

export const MAX_AVATAR_GENERATES = 2;

export const generateAvatar = async (deps: Deps, userId: UserId, facePhotoKey: string) => {
  const current = await deps.avatarRepo.get(userId);
  if ((current?.regenerateCount ?? 0) >= MAX_AVATAR_GENERATES) {
    return { error: 'limit_reached', statusCode: 403 } as const;
  }

  const goal = await deps.userRepo.getGoal(userId);
  const mode: GoalMode = goal?.mode ?? 'maintain';
  const descriptions = BODY_DESCRIPTIONS[mode];

  const base64Face = await getObjectBase64(facePhotoKey);
  const avatarImages: Partial<Record<number, string | null>> = {};
  const errors: Array<{ state: number; error: string }> = [];

  for (let i = 0; i < 5; i++) {
    try {
      const result = await generateAvatarImage(base64Face, descriptions[i]);
      const key = `avatars/${userId}/state_${i}.png`;
      await putObject(key, Buffer.from(result.image_base64, 'base64'), result.mime_type ?? 'image/png');
      avatarImages[i] = publicUrl(key);
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
  await deps.avatarRepo.save(avatar);

  return { data: { avatarImages, errors: errors.length ? errors : undefined }, statusCode: 201 } as const;
};

export const updateAvatarState = async (deps: Deps, userId: UserId, bodyState: number) => {
  if (bodyState < 0 || bodyState > 4) return { error: 'bodyState must be 0-4', statusCode: 400 } as const;
  const updated = await deps.avatarRepo.updateBodyState(userId, bodyState, new Date().toISOString());
  return { data: updated, statusCode: 200 } as const;
};
