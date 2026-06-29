const noop = () => {};

export const logger = {
  log:   __DEV__ ? console.log.bind(console)   : noop,
  warn:  __DEV__ ? console.warn.bind(console)  : noop,
  error: console.error.bind(console), // エラーは本番でも記録
};
