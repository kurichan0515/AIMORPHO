import { UserId, DateString } from '../shared/types';

export type Streak = {
  userId: UserId;
  currentDays: number;
  longestDays: number;
  lastLoggedAt?: DateString;
};

export type StreakUpdateResult = {
  streak: Streak;
  isNewDay: boolean;
  returnedAfterBreak: boolean;
};

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export const emptyStreak = (userId: UserId): Streak => ({
  userId,
  currentDays: 0,
  longestDays: 0,
});

export const updateStreak = (streak: Streak, nowIso: DateString, toJSTDate: (iso: string) => string): StreakUpdateResult => {
  const todayJST = toJSTDate(nowIso);
  const lastDate = streak.lastLoggedAt ? toJSTDate(streak.lastLoggedAt) : null;
  if (lastDate === todayJST) return { streak, isNewDay: false, returnedAfterBreak: false };

  const yesterday = toJSTDate(new Date(new Date(nowIso).getTime() - 86400000).toISOString());
  const dayBefore  = toJSTDate(new Date(new Date(nowIso).getTime() - 2 * 86400000).toISOString());

  // 1日グレース: 昨日 or 一昨日に記録 → ストリーク継続
  const withinGrace     = lastDate === yesterday || lastDate === dayBefore;
  const returnedAfterBreak = !!lastDate && !withinGrace;

  const newCurrent = withinGrace ? streak.currentDays + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestDays);

  return {
    streak: { ...streak, currentDays: newCurrent, longestDays: newLongest, lastLoggedAt: nowIso },
    isNewDay: true,
    returnedAfterBreak,
  };
};
