export type Gender = 'male' | 'female';

const MALE_COLORS    = ['#4A90D9', '#5BA0E9', '#6EB0F0', '#8CC4F5', '#AAD4FA'];
const FEMALE_COLORS  = ['#E9607A', '#F07090', '#F585A5', '#F8A0BB', '#FABDD0'];
const NEUTRAL_COLORS = ['#7B68EE', '#9278F0', '#A88EF2', '#BDAAF5', '#D0C5F8'];

export type DefaultAvatar = {
  backgroundColor: string;
  emoji: string;
};

const MALE_EMOJI    = ['🏆', '💪', '🧍', '😴', '😵'];
const FEMALE_EMOJI  = ['🏆', '💪', '🧍‍♀️', '😴', '😵'];
const NEUTRAL_EMOJI = ['🏆', '💪', '🧑', '😴', '😵'];

export const getDefaultAvatars = (gender: Gender | null): Record<number, DefaultAvatar> => {
  const colors = gender === 'male' ? MALE_COLORS : gender === 'female' ? FEMALE_COLORS : NEUTRAL_COLORS;
  const emojis = gender === 'male' ? MALE_EMOJI  : gender === 'female' ? FEMALE_EMOJI  : NEUTRAL_EMOJI;
  return Object.fromEntries(
    [0, 1, 2, 3, 4].map(i => [i, { backgroundColor: colors[i], emoji: emojis[i] }])
  );
};

export const DEFAULT_AVATAR_LABELS = ['ゴール達成', '順調', '標準', '要注意', '要ケア'];
