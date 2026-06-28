import { useState, useCallback } from 'react';

export type StreakCelebrationData = {
  days: number;
  badgeName?: string;
  isComeback?: boolean;
};

export function useStreakCelebration() {
  const [celebration, setCelebration] = useState<StreakCelebrationData | null>(null);
  const [visible, setVisible] = useState(false);

  const trigger = useCallback((data: { streakInfo?: any; newBadges?: any[] }) => {
    const { streakInfo, newBadges } = data;
    if (!streakInfo) return;

    const streakBadge = newBadges?.find(b => b.badgeId?.startsWith('streak_'));

    if (streakInfo.streakMilestone) {
      setCelebration({ days: streakInfo.streakMilestone, badgeName: streakBadge?.name });
      setVisible(true);
    } else if (streakInfo.returnedAfterBreak) {
      setCelebration({ days: streakInfo.currentDays, isComeback: true });
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setCelebration(null);
  }, []);

  return { celebration, visible, trigger, dismiss };
}
