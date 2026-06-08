export type Gender = 'male' | 'female';

const MALE_COLORS = ['#4A90D9', '#5BA0E9', '#6EB0F0', '#8CC4F5', '#AAD4FA'];
const FEMALE_COLORS = ['#E9607A', '#F07090', '#F585A5', '#F8A0BB', '#FABDD0'];

export type DefaultAvatar = {
  backgroundColor: string;
  emoji: string;
};

const MALE_EMOJI   = ['💪', '🏃', '🧍', '🥤', '🍔'];
const FEMALE_EMOJI = ['💃', '🏃‍♀️', '🧍‍♀️', '🥤', '🍔'];

export const getDefaultAvatars = (gender: Gender): Record<number, DefaultAvatar> => {
  const colors = gender === 'male' ? MALE_COLORS : FEMALE_COLORS;
  const emojis = gender === 'male' ? MALE_EMOJI   : FEMALE_EMOJI;
  return Object.fromEntries(
    [0, 1, 2, 3, 4].map(i => [i, { backgroundColor: colors[i], emoji: emojis[i] }])
  );
};

export const DEFAULT_AVATAR_LABELS = ['理想体型', 'やや改善', '標準', 'やや太り', 'ペナルティ'];
