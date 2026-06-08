import { UserId, DateString } from '../shared/types';

export type AvatarImages = Record<0 | 1 | 2 | 3 | 4, string | null>;

export type Avatar = {
  userId: UserId;
  facePhotoKey?: string;
  avatarImages: Partial<AvatarImages>;
  bodyState: 0 | 1 | 2 | 3 | 4;
  missedDays: number;
  bodyBalance?: number;
  regenerateCount: number;
  updatedAt: DateString;
};

export const degradeBodyState = (avatar: Avatar): Avatar => ({
  ...avatar,
  bodyState: Math.min(avatar.bodyState + 1, 4) as Avatar['bodyState'],
});

export const improveBodyState = (avatar: Avatar): Avatar => ({
  ...avatar,
  bodyState: Math.max(avatar.bodyState - 1, 0) as Avatar['bodyState'],
});

export const resetBodyState = (avatar: Avatar): Avatar => ({
  ...avatar,
  bodyState: 0,
});
