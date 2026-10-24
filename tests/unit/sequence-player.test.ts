import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Color } from '../../src/game/engine';
import { FLASH_MS, GAP_MS } from '../../src/game/timing';
import { createSequencePlayer } from '../../src/sequence-player';

const scheduler = {
  setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
  clearTimeout: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

function setup() {
  const events: string[] = [];
  const player = createSequencePlayer({
    onLight: (color) => events.push(`${Date.now()}:${color ?? 'off'}`),
    onTone: (color, ms) => events.push(`${Date.now()}:tone-${color}-${ms}`),
    scheduler,
  });
  return { events, player };
}

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sequence player', () => {
  it('lights each color with its tone at a fixed pace', async () => {
    const { events, player } = setup();
    const done = player.play(['red', 'blue']);
    await vi.runAllTimersAsync();
    expect(await done).toBe(true);
    const second = FLASH_MS + GAP_MS;
    expect(events).toEqual([
      '0:red',
      `0:tone-red-${FLASH_MS}`,
      `${FLASH_MS}:off`,
      `${second}:blue`,
      `${second}:tone-blue-${FLASH_MS}`,
      `${second + FLASH_MS}:off`,
    ]);
  });

  it('shows a repeated color as two separate flashes', async () => {
    const { events, player } = setup();
    const sequence: Color[] = ['green', 'green'];
    const done = player.play(sequence);
    await vi.runAllTimersAsync();
    await done;
    const lights = events.filter((e) => !e.includes('tone'));
    expect(lights).toEqual([
      '0:green',
      `${FLASH_MS}:off`,
      `${FLASH_MS + GAP_MS}:green`,
      `${2 * FLASH_MS + GAP_MS}:off`,
    ]);
  });

  it('stops immediately on cancel and resolves to false', async () => {
    const { events, player } = setup();
    const done = player.play(['red', 'blue', 'yellow']);
    await vi.advanceTimersByTimeAsync(FLASH_MS / 2);
    player.cancel();
    expect(await done).toBe(false);
    await vi.runAllTimersAsync();
    expect(events.at(-1)).toBe(`${FLASH_MS / 2}:off`);
    expect(events.some((e) => e.includes('blue'))).toBe(false);
  });

  it('releases a cancelled wait', async () => {
    const { player } = setup();
    const waiting = player.wait(1000);
    player.cancel();
    expect(await waiting).toBe(false);
  });
});
