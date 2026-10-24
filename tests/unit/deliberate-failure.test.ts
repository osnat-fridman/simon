import { expect, test } from 'vitest';

// Temporary: proves that a failing test stops the CI run. Removed right after.
test('deliberate failure', () => {
  expect(1).toBe(2);
});
