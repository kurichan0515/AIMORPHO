// NetInfoなしでaxiosインターセプターからネットワーク状態を追跡
let _isOffline = false;
const _listeners = new Set<(v: boolean) => void>();

export const setNetworkOffline = (offline: boolean) => {
  if (_isOffline === offline) return;
  _isOffline = offline;
  _listeners.forEach(fn => fn(offline));
};

export const subscribeNetworkStatus = (fn: (isOffline: boolean) => void) => {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
};

export const getIsOffline = () => _isOffline;
