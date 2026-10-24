import { describe, expect, it } from 'vitest';
import {
  COLORS,
  IDLE_STATE,
  STAGE_COUNT,
  newGame,
  nextStage,
  pause,
  playbackDone,
  press,
  resume,
  score,
  type Color,
  type GameState,
  type Rng,
} from '../../src/game/engine';

// Deterministic rng that walks through the given color indexes.
function rngFrom(indexes: number[]): Rng {
  let i = 0;
  return () => (indexes[i++ % indexes.length] + 0.5) / COLORS.length;
}

function playStage(state: GameState): GameState {
  let current = playbackDone(state);
  for (const color of current.sequence) {
    current = press(current, color).state;
  }
  return current;
}

function wrongColor(color: Color): Color {
  return COLORS.find((c) => c !== color)!;
}

describe('game engine', () => {
  it('starts with a single color in playback', () => {
    const state = newGame(rngFrom([2]));
    expect(state.phase).toBe('playback');
    expect(state.sequence).toEqual(['yellow']);
    expect(score(state)).toBe(0);
  });

  it('keeps the previous sequence and appends exactly one color per stage', () => {
    const rng = rngFrom([0, 1, 2, 3]);
    let state = newGame(rng);
    for (let stage = 1; stage < STAGE_COUNT; stage++) {
      const before = state.sequence;
      state = nextStage(playStage(state), rng);
      expect(state.sequence).toHaveLength(stage + 1);
      expect(state.sequence.slice(0, stage)).toEqual(before);
    }
  });

  it('allows the same color to repeat', () => {
    const rng = rngFrom([1]);
    const state = nextStage(playStage(newGame(rng)), rng);
    expect(state.sequence).toEqual(['red', 'red']);
  });

  it('wins with score 10 after stage 10 and never creates stage 11', () => {
    const rng = rngFrom([3, 0, 0, 2]);
    let state = newGame(rng);
    for (let stage = 1; stage <= STAGE_COUNT; stage++) {
      state = playStage(state);
      if (stage < STAGE_COUNT) state = nextStage(state, rng);
    }
    expect(state.phase).toBe('won');
    expect(score(state)).toBe(10);
    expect(nextStage(state, rng).sequence).toHaveLength(STAGE_COUNT);
  });

  it('loses on stage 1 with score 0', () => {
    const state = playbackDone(newGame(rngFrom([0])));
    const { state: after, result } = press(state, wrongColor(state.sequence[0]));
    expect(result).toBe('lost');
    expect(after.phase).toBe('lost');
    expect(score(after)).toBe(0);
  });

  it('loses on stage 10 with score 9', () => {
    const rng = rngFrom([1, 3]);
    let state = newGame(rng);
    for (let stage = 1; stage < STAGE_COUNT; stage++) state = nextStage(playStage(state), rng);
    state = playbackDone(state);
    const last = state.sequence[STAGE_COUNT - 1];
    for (const color of state.sequence.slice(0, -1)) state = press(state, color).state;
    const { state: after, result } = press(state, wrongColor(last));
    expect(result).toBe('lost');
    expect(score(after)).toBe(9);
  });

  it('only increases the score when a stage is completed', () => {
    const rng = rngFrom([0, 1]);
    let state = playbackDone(nextStage(playStage(newGame(rng)), rng));
    const first = press(state, state.sequence[0]);
    expect(first.result).toBe('correct');
    expect(score(first.state)).toBe(1);
    const second = press(first.state, state.sequence[1]);
    expect(second.result).toBe('stage-complete');
    expect(score(second.state)).toBe(2);
    state = second.state;
    expect(state.phase).toBe('playback');
  });

  it('ignores input outside the player turn', () => {
    for (const state of [IDLE_STATE, newGame(rngFrom([0]))]) {
      expect(press(state, 'blue')).toEqual({ state, result: 'ignored' });
    }
    const lost = press(playbackDone(newGame(rngFrom([0]))), 'red').state;
    expect(press(lost, 'blue')).toEqual({ state: lost, result: 'ignored' });
  });

  it('resumes the same stage from the start without adding a color', () => {
    const rng = rngFrom([0, 2]);
    let state = playbackDone(nextStage(playStage(newGame(rng)), rng));
    state = press(state, state.sequence[0]).state;
    const paused = pause(state);
    expect(paused.phase).toBe('paused');
    const resumed = resume(paused);
    expect(resumed.phase).toBe('playback');
    expect(resumed.inputIndex).toBe(0);
    expect(resumed.sequence).toEqual(state.sequence);
    expect(score(resumed)).toBe(1);
  });

  it('does not pause idle or finished games', () => {
    expect(pause(IDLE_STATE)).toBe(IDLE_STATE);
    const lost = press(playbackDone(newGame(rngFrom([0]))), 'red').state;
    expect(pause(lost)).toBe(lost);
  });
});
