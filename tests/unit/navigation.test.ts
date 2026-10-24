import { describe, expect, it } from 'vitest';
import { INITIAL_SCREEN, isScreen } from '../../src/navigation';

describe('navigation', () => {
  it('starts on the home screen', () => {
    expect(INITIAL_SCREEN).toBe('home');
  });

  it('accepts only the two known screens', () => {
    expect(isScreen('home')).toBe(true);
    expect(isScreen('about')).toBe(true);
    expect(isScreen('settings')).toBe(false);
    expect(isScreen(undefined)).toBe(false);
  });
});
