import { describe, expect, test } from '@jest/globals';
import { isRelaxedStartupEnabled } from '../../src/config/startup';

describe('isRelaxedStartupEnabled', () => {
  test('returns true when HASHHIVE_RELAXED_STARTUP is "1"', () => {
    expect(isRelaxedStartupEnabled({ HASHHIVE_RELAXED_STARTUP: '1' })).toBe(true);
  });

  test('returns true when HASHHIVE_RELAXED_STARTUP is "true"', () => {
    expect(isRelaxedStartupEnabled({ HASHHIVE_RELAXED_STARTUP: 'true' })).toBe(true);
  });

  test('returns false when HASHHIVE_RELAXED_STARTUP is unset', () => {
    expect(isRelaxedStartupEnabled({})).toBe(false);
  });

  test('returns false for other values', () => {
    expect(isRelaxedStartupEnabled({ HASHHIVE_RELAXED_STARTUP: '0' })).toBe(false);
    expect(isRelaxedStartupEnabled({ HASHHIVE_RELAXED_STARTUP: 'false' })).toBe(false);
    expect(isRelaxedStartupEnabled({ HASHHIVE_RELAXED_STARTUP: 'yes' })).toBe(false);
  });
});
