import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createController } from '../../src/controller';
import { COLORS, STAGE_COUNT, type Color, type GameState } from '../../src/game/engine';
import { FLASH_MS, GAP_MS, ROUND_PAUSE_MS } from '../../src/game/timing';
import { createSequencePlayer } from '../../src/sequence-player';
import type { GameView } from '../../src/view';

const scheduler = {
  setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
  clearTimeout: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

function playbackMs(length: number): number {
  return ROUND_PAUSE_MS + length * FLASH_MS + (length - 1) * GAP_MS;
}

function setup({ saveOk = true, stored = null as number | null, rngIndex = 0 } = {}) {
  const lit: (Color | null)[] = [];
  const view: GameView & { lastResult?: [number | null, boolean]; saveNotice?: boolean } = {
    render: vi.fn(),
    light: (color) => lit.push(color),
    showLastResult(score, saved) {
      view.lastResult = [score, saved];
    },
    setSaveNotice(visible) {
      view.saveNotice = visible;
    },
    setAudioNotice: vi.fn(),
    focusPlayAgain: vi.fn(),
  };
  const audio = { unlock: vi.fn(), play: vi.fn(), stopAll: vi.fn() };
  const results = { load: vi.fn(() => stored), save: vi.fn(() => saveOk) };
  const player = createSequencePlayer({
    onLight: (color) => view.light(color),
    onTone: (color, ms) => audio.play(color, ms),
    scheduler,
  });
  const rng = () => (rngIndex + 0.5) / COLORS.length;
  const controller = createController({ view, player, audio, results, scheduler, rng });
  return { controller, view, audio, results, lit };
}

type Controller = ReturnType<typeof setup>['controller'];

async function waitForInput(controller: Controller): Promise<GameState> {
  await vi.advanceTimersByTimeAsync(playbackMs(controller.state.sequence.length));
  expect(controller.state.phase).toBe('input');
  return controller.state;
}

async function answerStage(controller: Controller): Promise<void> {
  const state = await waitForInput(controller);
  for (const color of state.sequence) controller.pressPad(color);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('controller', () => {
  it('shows the last stored result on load', () => {
    const { view } = setup({ stored: 4 });
    expect(view.lastResult).toEqual([4, true]);
  });

  it('starts only from the start action and unlocks audio inside it', () => {
    const { controller, audio } = setup();
    expect(controller.state.phase).toBe('idle');
    controller.start();
    expect(audio.unlock).toHaveBeenCalledOnce();
    expect(controller.state.phase).toBe('playback');
  });

  it('ignores input during playback', async () => {
    const { controller } = setup();
    controller.start();
    await vi.advanceTimersByTimeAsync(ROUND_PAUSE_MS + 10);
    const before = controller.state;
    controller.pressPad('green');
    expect(controller.state).toBe(before);
  });

  it('plays through 10 stages to a win and saves score 10 once', async () => {
    const { controller, results, view } = setup();
    controller.start();
    for (let stage = 1; stage <= STAGE_COUNT; stage++) await answerStage(controller);
    expect(controller.state.phase).toBe('won');
    expect(controller.state.sequence).toHaveLength(STAGE_COUNT);
    expect(results.save).toHaveBeenCalledOnce();
    expect(results.save).toHaveBeenCalledWith(10);
    expect(view.lastResult).toEqual([10, true]);

    // No stage 11 is scheduled, and input after the end changes nothing.
    await vi.runAllTimersAsync();
    controller.pressPad('blue');
    expect(controller.state.phase).toBe('won');
    expect(results.save).toHaveBeenCalledOnce();
  });

  it('loses on the first wrong press and saves completed stages', async () => {
    const { controller, results } = setup({ rngIndex: 0 });
    controller.start();
    await answerStage(controller);
    await waitForInput(controller);
    controller.pressPad('blue');
    controller.pressPad('red');
    expect(controller.state.phase).toBe('lost');
    expect(results.save).toHaveBeenCalledWith(1);
    controller.pressPad('blue');
    expect(results.save).toHaveBeenCalledOnce();
  });

  it('does not save when a new game starts mid-game', async () => {
    const { controller, results } = setup();
    controller.start();
    await answerStage(controller);
    controller.start();
    expect(controller.state.sequence).toHaveLength(1);
    await vi.runAllTimersAsync();
    expect(results.save).not.toHaveBeenCalled();
  });

  it('keeps the new score in memory and shows a notice when saving fails', async () => {
    const { controller, view } = setup({ saveOk: false, stored: 8 });
    controller.start();
    await waitForInput(controller);
    controller.pressPad('red');
    expect(view.saveNotice).toBe(true);
    expect(view.lastResult).toEqual([0, false]);
  });

  it('pauses on about and replays the same stage from the start on return', async () => {
    const { controller, audio, lit } = setup();
    controller.start();
    await answerStage(controller);
    const state = await waitForInput(controller);
    controller.pressPad(state.sequence[0]);

    controller.onScreenChange('about');
    expect(controller.state.phase).toBe('paused');
    expect(audio.stopAll).toHaveBeenCalled();
    expect(lit.at(-1)).toBeNull();
    await vi.runAllTimersAsync();
    expect(controller.state.phase).toBe('paused');

    controller.onScreenChange('home');
    expect(controller.state.phase).toBe('playback');
    const resumed = await waitForInput(controller);
    expect(resumed.sequence).toEqual(state.sequence);
    expect(resumed.inputIndex).toBe(0);
    expect(resumed.completedStages).toBe(1);
  });

  it('stops a sequence mid-playback when leaving and never lights it afterwards', async () => {
    const { controller, lit } = setup();
    controller.start();
    await vi.advanceTimersByTimeAsync(ROUND_PAUSE_MS + FLASH_MS / 2);
    controller.onScreenChange('about');
    const count = lit.length;
    await vi.runAllTimersAsync();
    expect(lit.slice(count).every((color) => color === null)).toBe(true);
  });

  it('does not start or change a game when navigating while idle or finished', async () => {
    const { controller } = setup();
    controller.onScreenChange('about');
    controller.onScreenChange('home');
    expect(controller.state.phase).toBe('idle');

    controller.start();
    await waitForInput(controller);
    controller.pressPad('red');
    const lost = controller.state;
    expect(lost.phase).toBe('lost');
    controller.onScreenChange('about');
    controller.onScreenChange('home');
    expect(controller.state).toBe(lost);
  });

  it('cancels callbacks from a previous game', async () => {
    const { controller } = setup();
    controller.start();
    await vi.advanceTimersByTimeAsync(ROUND_PAUSE_MS / 2);
    controller.start();
    await vi.advanceTimersByTimeAsync(ROUND_PAUSE_MS / 2 + 10);
    // The first game's wait would have ended here; the new game is still in its own pause.
    expect(controller.state.phase).toBe('playback');
    await waitForInput(controller);
    expect(controller.state.sequence).toHaveLength(1);
  });
});
