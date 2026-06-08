import { IAvatarRepository } from '../../domain/avatar/IAvatarRepository';
import { Avatar } from '../../domain/avatar/Avatar';
import { generateAvatarImage } from '../../infrastructure/gemini/GeminiClient';
import { getUploadUrl, getObjectBase64, putObject, publicUrl, BUCKET } from '../../infrastructure/s3/S3Client';
import { UserId } from '../../domain/shared/types';

type Deps = { avatarRepo: IAvatarRepository };

const BODY_DESCRIPTIONS = [
  '細身でスリムな体型（理想体型・目標達成）',
  '少しスリムな体型（やや改善）',
  '標準的な体型（中間）',
  '少し太めの体型（やや太り気味）',
  'ぽっちゃりした体型（最大ペナルティ）',
];

export const getAvatarUploadUrl = async (userId: UserId) => {
  const key = `faces/${userId}/${Date.now()}.jpg`;
  const uploadUrl = await getUploadUrl(key);
  return { data: { uploadUrl, s3Key: key }, statusCode: 200 } as const;
};

export const generateAvatar = async (deps: Deps, userId: UserId, facePhotoKey: string) => {
  const base64Face = await getObjectBase64(facePhotoKey);
  const avatarImages: Partial<Record<number, string | null>> = {};
  const errors: Array<{ state: number; error: string }> = [];

  for (let i = 0; i < 5; i++) {
    try {
      const result = await generateAvatarImage(base64Face, BODY_DESCRIPTIONS[i]);
      const key = `avatars/${userId}/state_${i}.png`;
      await putObject(key, Buffer.from(result.image_base64, 'base64'), result.mime_type ?? 'image/png');
      avatarImages[i] = publicUrl(key);
    } catch (e) {
      errors.push({ state: i, error: (e as Error).message });
      avatarImages[i] = null;
    }
  }

  const now = new Date().toISOString();
  const current = await deps.avatarRepo.get(userId);
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
