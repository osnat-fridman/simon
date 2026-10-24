import type { Color } from './game/engine';
import { FLASH_MS, GAP_MS } from './game/timing';

export interface Scheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const browserScheduler: Scheduler = {
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
};

export interface SequencePlayerOptions {
  /** Called with a color to light it, and with null to turn every pad off. */
  onLight(color: Color | null): void;
  onTone(color: Color, ms: number): void;
  scheduler?: Scheduler;
}

// Plays a sequence one step at a time so it can be stopped at any point.
// Every pending wait resolves to false on cancel, so callers never hang.
export function createSequencePlayer({
  onLight,
  onTone,
  scheduler = browserScheduler,
}: SequencePlayerOptions) {
  let pending: { id: unknown; resolve: (done: boolean) => void } | null = null;

  function wait(ms: number): Promise<boolean> {
    cancel();
    return new Promise((resolve) => {
      const id = scheduler.setTimeout(() => {
        pending = null;
        resolve(true);
      }, ms);
      pending = { id, resolve };
    });
  }

  function cancel(): void {
    if (!pending) return;
    const { id, resolve } = pending;
    pending = null;
    scheduler.clearTimeout(id);
    resolve(false);
  }

  async function play(sequence: readonly Color[]): Promise<boolean> {
    for (let i = 0; i < sequence.length; i++) {
      const color = sequence[i];
      onLight(color);
      onTone(color, FLASH_MS);
      const lit = await wait(FLASH_MS);
      onLight(null);
      if (!lit) return false;
      if (i < sequence.length - 1 && !(await wait(GAP_MS))) return false;
    }
    return true;
  }

  return { play, wait, cancel };
}

export type SequencePlayer = ReturnType<typeof createSequencePlayer>;
