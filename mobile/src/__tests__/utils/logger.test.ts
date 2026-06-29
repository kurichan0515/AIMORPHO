// logger.ts の動作確認
// __DEV__ が true のとき console.log/warn を呼ぶ、error は常に呼ぶ

const origLog   = console.log;
const origWarn  = console.warn;
const origError = console.error;

beforeEach(() => {
  console.log   = jest.fn();
  console.warn  = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log   = origLog;
  console.warn  = origWarn;
  console.error = origError;
  jest.resetModules();
});

describe('logger (__DEV__ = true)', () => {
  beforeEach(() => {
    (global as any).__DEV__ = true;
  });

  test('logger.log が console.log を呼ぶ', () => {
    const { logger } = require('../../utils/logger');
    logger.log('test');
    expect(console.log).toHaveBeenCalledWith('test');
  });

  test('logger.warn が console.warn を呼ぶ', () => {
    const { logger } = require('../../utils/logger');
    logger.warn('warn test');
    expect(console.warn).toHaveBeenCalledWith('warn test');
  });

  test('logger.error が console.error を呼ぶ', () => {
    const { logger } = require('../../utils/logger');
    logger.error('error test');
    expect(console.error).toHaveBeenCalledWith('error test');
  });
});

describe('logger (__DEV__ = false)', () => {
  beforeEach(() => {
    (global as any).__DEV__ = false;
  });

  test('logger.log は何も呼ばない', () => {
    const { logger } = require('../../utils/logger');
    logger.log('test');
    expect(console.log).not.toHaveBeenCalled();
  });

  test('logger.warn は何も呼ばない', () => {
    const { logger } = require('../../utils/logger');
    logger.warn('warn test');
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('logger.error は本番でも console.error を呼ぶ', () => {
    const { logger } = require('../../utils/logger');
    logger.error('error test');
    expect(console.error).toHaveBeenCalledWith('error test');
  });
});
