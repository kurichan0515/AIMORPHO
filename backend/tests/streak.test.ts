import { updateStreak, emptyStreak, STREAK_MILESTONES } from '../src/domain/user/Streak';

const toJST = (iso: string) => iso.slice(0, 10); // 簡略化（テスト用）

const makeStreak = (currentDays: number, lastLoggedAt?: string) => ({
  ...emptyStreak('user1'),
  currentDays,
  longestDays: currentDays,
  lastLoggedAt,
});

const nowIso = '2026-06-20T10:00:00.000Z'; // 2026-06-20 (JST)

describe('updateStreak', () => {
  test('同日 → 変化なし', () => {
    const streak = makeStreak(5, '2026-06-20T08:00:00.000Z');
    const r = updateStreak(streak, nowIso, toJST);
    expect(r.isNewDay).toBe(false);
    expect(r.streak.currentDays).toBe(5);
  });

  test('昨日に記録 → +1（通常継続）', () => {
    const streak = makeStreak(5, '2026-06-19T10:00:00.000Z');
    const r = updateStreak(streak, nowIso, toJST);
    expect(r.isNewDay).toBe(true);
    expect(r.streak.currentDays).toBe(6);
    expect(r.returnedAfterBreak).toBe(false);
  });

  test('一昨日に記録 → +1（1日グレース期間）', () => {
    const streak = makeStreak(5, '2026-06-18T10:00:00.000Z');
    const r = updateStreak(streak, nowIso, toJST);
    expect(r.isNewDay).toBe(true);
    expect(r.streak.currentDays).toBe(6);
    expect(r.returnedAfterBreak).toBe(false);
  });

  test('3日前に記録 → リセット + returnedAfterBreak', () => {
    const streak = makeStreak(10, '2026-06-17T10:00:00.000Z');
    const r = updateStreak(streak, nowIso, toJST);
    expect(r.isNewDay).toBe(true);
    expect(r.streak.currentDays).toBe(1);
    expect(r.returnedAfterBreak).toBe(true);
  });

  test('初回記録 → currentDays=1、returnedAfterBreak=false', () => {
    const streak = emptyStreak('user1');
    const r = updateStreak(streak, nowIso, toJST);
    expect(r.streak.currentDays).toBe(1);
    expect(r.returnedAfterBreak).toBe(false);
  });

  test('longestDays は currentDays を超えたとき更新', () => {
    const streak = { ...makeStreak(6, '2026-06-19T10:00:00.000Z'), longestDays: 6 };
    const r = updateStreak(streak, nowIso, toJST);
    expect(r.streak.currentDays).toBe(7);
    expect(r.streak.longestDays).toBe(7);
  });

  test('longestDays は currentDays 未満のとき変化なし', () => {
    const streak = { ...makeStreak(2, '2026-06-19T10:00:00.000Z'), longestDays: 30 };
    const r = updateStreak(streak, nowIso, toJST);
    expect(r.streak.currentDays).toBe(3);
    expect(r.streak.longestDays).toBe(30);
  });
});

describe('STREAK_MILESTONES', () => {
  test('3, 7, 14, 30, 60, 100 を含む', () => {
    expect(STREAK_MILESTONES).toContain(3);
    expect(STREAK_MILESTONES).toContain(7);
    expect(STREAK_MILESTONES).toContain(14);
    expect(STREAK_MILESTONES).toContain(30);
    expect(STREAK_MILESTONES).toContain(60);
    expect(STREAK_MILESTONES).toContain(100);
  });

  test('3日目でマイルストーン検出', () => {
    const streak = makeStreak(2, '2026-06-19T10:00:00.000Z');
    const r = updateStreak(streak, nowIso, toJST);
    expect(STREAK_MILESTONES.includes(r.streak.currentDays)).toBe(true);
  });
});
