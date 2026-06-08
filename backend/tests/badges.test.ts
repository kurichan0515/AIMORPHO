import { BADGE_DEFINITIONS } from '../src/domain/badge/Badge';

describe('BADGE_DEFINITIONS', () => {
  test('全バッジにid/name/typeが存在する', () => {
    for (const b of BADGE_DEFINITIONS) {
      expect(b.id).toBeTruthy();
      expect(b.name).toBeTruthy();
      expect(b.type).toBeTruthy();
    }
  });

  test('streak バッジの threshold 昇順', () => {
    const streakBadges = BADGE_DEFINITIONS.filter(b => b.type === 'streak');
    const thresholds = streakBadges.map(b => b.threshold);
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
  });

  test('goal_achieve バッジが存在する', () => {
    expect(BADGE_DEFINITIONS.find(b => b.id === 'goal_achieve')).toBeDefined();
  });
});
