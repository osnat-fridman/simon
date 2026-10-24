import { describe, expect, it } from 'vitest';
import { RESULT_KEY, loadLastResult, saveLastResult } from '../../src/storage';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('result storage', () => {
  it('saves and loads the last result with the defined schema', () => {
    const storage = memoryStorage();
    expect(saveLastResult(7, storage)).toBe(true);
    expect(storage.data.get(RESULT_KEY)).toBe('{"schemaVersion":1,"score":7}');
    expect(loadLastResult(storage)).toBe(7);
  });

  it('overwrites a higher previous result with a lower one', () => {
    const storage = memoryStorage();
    saveLastResult(10, storage);
    saveLastResult(2, storage);
    expect(loadLastResult(storage)).toBe(2);
  });

  it('treats missing data as no result', () => {
    expect(loadLastResult(memoryStorage())).toBeNull();
    expect(loadLastResult(null)).toBeNull();
  });

  it.each([
    'not json',
    'null',
    '7',
    '{"schemaVersion":2,"score":7}',
    '{"schemaVersion":1,"score":11}',
    '{"schemaVersion":1,"score":-1}',
    '{"schemaVersion":1,"score":3.5}',
    '{"schemaVersion":1,"score":"7"}',
    '{"score":7}',
  ])('treats corrupt value %s as no result', (raw) => {
    expect(loadLastResult(memoryStorage({ [RESULT_KEY]: raw }))).toBeNull();
  });

  it('reports failure instead of throwing when storage is blocked', () => {
    expect(loadLastResult(throwing)).toBeNull();
    expect(saveLastResult(5, throwing)).toBe(false);
    expect(saveLastResult(5, null)).toBe(false);
  });
});
