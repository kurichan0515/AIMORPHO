import { UserId, BadgeId, BadgeType, DateString } from '../shared/types';

export type Badge = {
  userId: UserId;
  badgeId: BadgeId;
  name: string;
  description: string;
  earnedAt: DateString;
};

export type BadgeDef = {
  id: BadgeId;
  name: string;
  description: string;
  type: BadgeType;
  threshold: number;
};

export const BADGE_DEFINITIONS: BadgeDef[] = [
  { id: 'weight_first',  name: '初計測',     description: '初めて体重を記録した',           type: 'weight',  threshold: 1 },
  { id: 'streak_3',      name: '3日連続',     description: '3日連続でログを記録した',         type: 'streak',  threshold: 3 },
  { id: 'streak_7',      name: '1週間継続',   description: '7日連続でログを記録した',         type: 'streak',  threshold: 7 },
  { id: 'streak_30',     name: '1ヶ月継続',   description: '30日連続でログを記録した',        type: 'streak',  threshold: 30 },
  { id: 'exercise_10',   name: '運動10回',    description: '運動を10回記録した',             type: 'exercise', threshold: 10 },
  { id: 'exercise_50',   name: '運動50回',    description: '運動を50回記録した',             type: 'exercise', threshold: 50 },
  { id: 'meal_10',       name: '食事10回',    description: '食事を10回記録した',             type: 'meal',    threshold: 10 },
  { id: 'meal_50',       name: '食事50回',    description: '食事を50回記録した',             type: 'meal',    threshold: 50 },
  { id: 'goal_achieve',  name: '目標達成',    description: '目標体重を達成した',             type: 'special', threshold: 1 },
  { id: 'recovery',      name: '回復',        description: 'アバターを回復させた',            type: 'special', threshold: 1 },
];
