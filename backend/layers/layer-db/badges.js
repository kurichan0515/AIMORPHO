const BADGE_DEFINITIONS = [
  { id: 'streak_3',     name: '3日連続',       description: '3日連続ログイン',          type: 'streak',   threshold: 3   },
  { id: 'streak_7',     name: '1週間継続',      description: '7日連続ログイン',          type: 'streak',   threshold: 7   },
  { id: 'streak_30',    name: '1ヶ月継続',      description: '30日連続ログイン',         type: 'streak',   threshold: 30  },
  { id: 'streak_100',   name: '100日達人',      description: '100日連続ログイン',        type: 'streak',   threshold: 100 },
  { id: 'meal_10',      name: '食事記録10回',   description: '食事記録10回達成',         type: 'meal',     threshold: 10  },
  { id: 'meal_50',      name: '食事記録50回',   description: '食事記録50回達成',         type: 'meal',     threshold: 50  },
  { id: 'exercise_10',  name: '運動10回',       description: '運動記録10回達成',         type: 'exercise', threshold: 10  },
  { id: 'exercise_50',  name: '運動50回',       description: '運動記録50回達成',         type: 'exercise', threshold: 50  },
  { id: 'weight_first', name: '初計測',         description: '初めて体重を記録',         type: 'weight',   threshold: 1   },
  { id: 'goal_achieve', name: '目標達成！',     description: '目標体重を達成',           type: 'goal',     threshold: 1   },
  { id: 'recovery',     name: '立ち直り',       description: 'ペナルティから回復',       type: 'recovery', threshold: 1   },
];

module.exports = { BADGE_DEFINITIONS };
