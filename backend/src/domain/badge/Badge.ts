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
  // streak
  { id: 'streak_3',       name: '3日連続',     description: '3日連続でログを記録した',          type: 'streak',   threshold: 3   },
  { id: 'streak_7',       name: '1週間継続',   description: '7日連続でログを記録した',          type: 'streak',   threshold: 7   },
  { id: 'streak_14',      name: '2週間継続',   description: '14日連続でログを記録した',         type: 'streak',   threshold: 14  },
  { id: 'streak_30',      name: '1ヶ月継続',   description: '30日連続でログを記録した',         type: 'streak',   threshold: 30  },
  { id: 'streak_60',      name: '2ヶ月継続',   description: '60日連続でログを記録した',         type: 'streak',   threshold: 60  },
  { id: 'streak_100',     name: '100日継続',   description: '100日連続でログを記録した',        type: 'streak',   threshold: 100 },
  // log
  { id: 'weight_first',   name: '初計測',      description: '初めて体重を記録した',            type: 'weight',   threshold: 1   },
  { id: 'meal_first',     name: '初食事記録',  description: '初めて食事を記録した',            type: 'meal',     threshold: 1   },
  { id: 'exercise_first', name: '初トレーニング', description: '初めてトレーニングを記録した',  type: 'exercise', threshold: 1   },
  { id: 'meal_10',        name: '食事10回',    description: '食事を10回記録した',              type: 'meal',     threshold: 10  },
  { id: 'meal_50',        name: '食事50回',    description: '食事を50回記録した',              type: 'meal',     threshold: 50  },
  { id: 'exercise_10',    name: '運動10回',    description: '運動を10回記録した',              type: 'exercise', threshold: 10  },
  { id: 'exercise_50',    name: '運動50回',    description: '運動を50回記録した',              type: 'exercise', threshold: 50  },
  // special
  { id: 'goal_achieve',   name: '目標達成',    description: '目標体重を達成した',              type: 'special',  threshold: 1   },
  { id: 'recovery',       name: '体型回復',    description: 'アバターを回復させた',             type: 'special',  threshold: 1   },
  { id: 'comeback',       name: 'カムバック',  description: '中断後に記録を再開した',           type: 'special',  threshold: 1   },
];
