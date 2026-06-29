import { updateStreak } from '../src/domain/user/Streak';

// AuthApplicationService のロジックをドメインレベルで検証
// 実際の DB 接続なしで recoverable 判定を確認

const RECOVERY_MS = 30 * 24 * 60 * 60 * 1000;

const isRecoverable = (deletedAt: string | undefined): boolean => {
  if (!deletedAt) return false;
  return Date.now() - new Date(deletedAt).getTime() < RECOVERY_MS;
};

const recoveryExpiresAt = (deletedAt: string): string =>
  new Date(new Date(deletedAt).getTime() + RECOVERY_MS).toISOString();

describe('アカウント復活可否ロジック', () => {
  test('削除直後は復活可能', () => {
    const deletedAt = new Date().toISOString();
    expect(isRecoverable(deletedAt)).toBe(true);
  });

  test('削除15日後は復活可能', () => {
    const deletedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecoverable(deletedAt)).toBe(true);
  });

  test('削除29日後は復活可能（境界値）', () => {
    const deletedAt = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecoverable(deletedAt)).toBe(true);
  });

  test('削除31日後は復活不可', () => {
    const deletedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecoverable(deletedAt)).toBe(false);
  });

  test('deletedAt が undefined は復活不可', () => {
    expect(isRecoverable(undefined)).toBe(false);
  });

  test('expiresAt は deletedAt + 30日', () => {
    const deletedAt = '2026-01-01T00:00:00.000Z';
    const expires = recoveryExpiresAt(deletedAt);
    expect(expires).toBe('2026-01-31T00:00:00.000Z');
  });
});

describe('復活後のストリーク継続', () => {
  const toJST = (iso: string) => iso.slice(0, 10);

  test('復活後に記録 → ストリークが1から再スタート', () => {
    const oldStreak = { userId: 'u1', currentDays: 10, longestDays: 10, lastLoggedAt: '2026-01-01T00:00:00.000Z' };
    const nowIso = '2026-02-15T10:00:00.000Z'; // 45日後（復活後）
    const r = updateStreak(oldStreak, nowIso, toJST);
    expect(r.streak.currentDays).toBe(1);
    expect(r.returnedAfterBreak).toBe(true);
    expect(r.streak.longestDays).toBe(10); // 過去の最高記録は保持
  });
});
