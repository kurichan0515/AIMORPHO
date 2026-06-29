import {
  setNetworkOffline,
  subscribeNetworkStatus,
  getIsOffline,
} from '../../utils/networkStatus';

beforeEach(() => {
  // 状態リセット
  setNetworkOffline(false);
});

describe('networkStatus', () => {
  test('初期状態はオンライン', () => {
    expect(getIsOffline()).toBe(false);
  });

  test('setNetworkOffline(true) でオフライン', () => {
    setNetworkOffline(true);
    expect(getIsOffline()).toBe(true);
  });

  test('setNetworkOffline(false) でオンライン復帰', () => {
    setNetworkOffline(true);
    setNetworkOffline(false);
    expect(getIsOffline()).toBe(false);
  });

  test('同じ値を再セットしても listener を呼ばない', () => {
    const listener = jest.fn();
    const unsub = subscribeNetworkStatus(listener);
    setNetworkOffline(false); // 初期値と同じ false → 変化なし
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  test('subscribe した listener が状態変化で呼ばれる', () => {
    const listener = jest.fn();
    const unsub = subscribeNetworkStatus(listener);
    setNetworkOffline(true);
    expect(listener).toHaveBeenCalledWith(true);
    setNetworkOffline(false);
    expect(listener).toHaveBeenCalledWith(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
  });

  test('unsubscribe 後は listener が呼ばれない', () => {
    const listener = jest.fn();
    const unsub = subscribeNetworkStatus(listener);
    unsub();
    setNetworkOffline(true);
    expect(listener).not.toHaveBeenCalled();
  });

  test('複数 listener が独立して動作する', () => {
    const l1 = jest.fn();
    const l2 = jest.fn();
    const u1 = subscribeNetworkStatus(l1);
    const u2 = subscribeNetworkStatus(l2);
    setNetworkOffline(true);
    expect(l1).toHaveBeenCalledWith(true);
    expect(l2).toHaveBeenCalledWith(true);
    u1();
    setNetworkOffline(false);
    expect(l1).toHaveBeenCalledTimes(1); // unsubscribe 済み
    expect(l2).toHaveBeenCalledTimes(2);
    u2();
  });
});
