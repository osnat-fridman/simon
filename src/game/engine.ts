// Pure game rules: no DOM, timers or storage.

export const COLORS = ['blue', 'red', 'yellow', 'green'] as const;
export type Color = (typeof COLORS)[number];

export const STAGE_COUNT = 10;

export type Phase = 'idle' | 'playback' | 'input' | 'paused' | 'won' | 'lost';

export interface GameState {
  readonly phase: Phase;
  readonly sequence: readonly Color[];
  readonly inputIndex: number;
  readonly completedStages: number;
}

export type PressResult = 'ignored' | 'correct' | 'stage-complete' | 'won' | 'lost';

export type Rng = () => number;

export const IDLE_STATE: GameState = {
  phase: 'idle',
  sequence: [],
  inputIndex: 0,
  completedStages: 0,
};

export function randomColor(rng: Rng = Math.random): Color {
  const index = Math.min(COLORS.length - 1, Math.floor(rng() * COLORS.length));
  return COLORS[index];
}

export function newGame(rng: Rng = Math.random): GameState {
  return { phase: 'playback', sequence: [randomColor(rng)], inputIndex: 0, completedStages: 0 };
}

export function playbackDone(state: GameState): GameState {
  if (state.phase !== 'playback') return state;
  return { ...state, phase: 'input', inputIndex: 0 };
}

export function press(state: GameState, color: Color): { state: GameState; result: PressResult } {
  if (state.phase !== 'input') return { state, result: 'ignored' };

  if (state.sequence[state.inputIndex] !== color) {
    return { state: { ...state, phase: 'lost' }, result: 'lost' };
  }

  const inputIndex = state.inputIndex + 1;
  if (inputIndex < state.sequence.length) {
    return { state: { ...state, inputIndex }, result: 'correct' };
  }

  const completedStages = state.completedStages + 1;
  if (completedStages >= STAGE_COUNT) {
    return { state: { ...state, inputIndex, completedStages, phase: 'won' }, result: 'won' };
  }
  // Stays out of `input` until the next stage starts, so extra taps are ignored.
  return {
    state: { ...state, inputIndex, completedStages, phase: 'playback' },
    result: 'stage-complete',
  };
}

// Appends one color after a completed stage; the sequence never grows past STAGE_COUNT.
export function nextStage(state: GameState, rng: Rng = Math.random): GameState {
  if (state.sequence.length !== state.completedStages || state.completedStages >= STAGE_COUNT) {
    return state;
  }
  return {
    ...state,
    phase: 'playback',
    inputIndex: 0,
    sequence: [...state.sequence, randomColor(rng)],
  };
}

export function isActive(state: GameState): boolean {
  return state.phase === 'playback' || state.phase === 'input';
}

export function pause(state: GameState): GameState {
  if (!isActive(state)) return state;
  return { ...state, phase: 'paused', inputIndex: 0 };
}

// Replays the same stage from the start; partial input is discarded.
export function resume(state: GameState): GameState {
  if (state.phase !== 'paused') return state;
  return { ...state, phase: 'playback', inputIndex: 0 };
}

export function score(state: GameState): number {
  return state.completedStages;
}

export function isFinished(state: GameState): boolean {
  return state.phase === 'won' || state.phase === 'lost';
}
