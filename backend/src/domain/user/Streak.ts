import { UserId, DateString } from '../shared/types';

export type Streak = {
  userId: UserId;
  currentDays: number;
  longestDays: number;
  lastLoggedAt?: DateString;
};

export const emptyStreak = (userId: UserId): Streak => ({
  userId,
  currentDays: 0,
  longestDays: 0,
});

export const updateStreak = (streak: Streak, nowIso: DateString, toJSTDate: (iso: string) => string): Streak => {
  const todayJST = toJSTDate(nowIso);
  const lastDate = streak.lastLoggedAt ? toJSTDate(streak.lastLoggedAt) : null;
  if (lastDate === todayJST) return streak;

  const yesterdayIso = new Date(new Date(nowIso).getTime() - 86400000).toISOString();
  const yesterday = toJSTDate(yesterdayIso);
  const newCurrent = lastDate === yesterday ? streak.currentDays + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestDays);

  return { ...streak, currentDays: newCurrent, longestDays: newLongest, lastLoggedAt: nowIso };
};
