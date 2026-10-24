import {
  IDLE_STATE,
  isActive,
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
} from './game/engine';
import {
  PRESS_FLASH_MS,
  ROUND_PAUSE_MS,
  WIN_FINALE_MS,
  WIN_LAPS,
  WIN_PAUSE_MS,
  WIN_STEP_MS,
} from './game/timing';
import { INITIAL_SCREEN, type Screen } from './navigation';
import type { Scheduler, SequencePlayer } from './sequence-player';
import type { GameView } from './view';

// Clockwise around the board, starting top left (see the pad layout in spec/DESIGN.md).
const WIN_LAP_ORDER: readonly Color[] = ['red', 'blue', 'yellow', 'green'];

export interface ControllerDeps {
  view: GameView;
  player: SequencePlayer;
  audio: { unlock(): void; play(color: Color, ms: number): void; stopAll(): void };
  results: { load(): number | null; save(score: number): boolean };
  scheduler: Scheduler;
  rng?: Rng;
}

// Source of truth for the running game; coordinates engine, playback, sound, view and storage.
export function createController({
  view,
  player,
  audio,
  results,
  scheduler,
  rng = Math.random,
}: ControllerDeps) {
  let state: GameState = IDLE_STATE;
  // Incremented on every start, pause and finish so stale async steps stop.
  let runToken = 0;
  let pressTimer: unknown = null;
  let screen: Screen = INITIAL_SCREEN;

  view.render(state);
  view.showLastResult(results.load(), true);

  function stopEverything(): void {
    runToken++;
    player.cancel();
    audio.stopAll();
    if (pressTimer !== null) scheduler.clearTimeout(pressTimer);
    pressTimer = null;
    view.light(null);
  }

  async function runStage(): Promise<void> {
    const token = ++runToken;
    view.render(state);
    if (!(await player.wait(ROUND_PAUSE_MS)) || token !== runToken) return;
    if (!(await player.play(state.sequence)) || token !== runToken) return;
    state = playbackDone(state);
    view.render(state);
  }

  function pressFeedback(color: Color): void {
    if (pressTimer !== null) scheduler.clearTimeout(pressTimer);
    view.light(color);
    audio.play(color, PRESS_FLASH_MS);
    pressTimer = scheduler.setTimeout(() => {
      pressTimer = null;
      view.light(null);
    }, PRESS_FLASH_MS);
  }

  // Light only, no sound. Any start, hide or navigation bumps runToken and stops it.
  async function celebrateWin(token: number): Promise<void> {
    if (!(await player.wait(WIN_PAUSE_MS)) || token !== runToken) return;
    for (let lap = 0; lap < WIN_LAPS; lap++) {
      for (const color of WIN_LAP_ORDER) {
        view.light(color);
        if (!(await player.wait(WIN_STEP_MS)) || token !== runToken) return;
      }
    }
    view.light('all');
    if (!(await player.wait(WIN_FINALE_MS)) || token !== runToken) return;
    view.light(null);
  }

  function finish(): void {
    // Input is already locked: the engine left the `input` phase before this runs.
    runToken++;
    player.cancel();
    const finalScore = score(state);
    const saved = results.save(finalScore);
    view.render(state);
    view.setSaveNotice(!saved);
    view.showLastResult(finalScore, saved);
    view.focusPlayAgain();
    if (state.phase === 'won') void celebrateWin(runToken);
  }

  function start(): void {
    audio.unlock();
    stopEverything();
    view.setSaveNotice(false);
    state = newGame(rng);
    void runStage();
  }

  function pressPad(color: Color): void {
    // A press is a user gesture, so it is the next chance to resume sound the browser blocked.
    audio.unlock();
    const outcome = press(state, color);
    if (outcome.result === 'ignored') return;
    state = outcome.state;
    pressFeedback(color);
    if (outcome.result === 'stage-complete') {
      state = nextStage(state, rng);
      void runStage();
    } else if (outcome.result === 'won' || outcome.result === 'lost') {
      finish();
    }
  }

  function pauseGame(): void {
    if (!isActive(state)) return;
    stopEverything();
    state = pause(state);
    view.render(state);
  }

  function resumeGame(): void {
    if (state.phase !== 'paused') return;
    audio.unlock();
    state = resume(state);
    void runStage();
  }

  function onScreenChange(next: Screen): void {
    screen = next;
    if (next === 'about') {
      // Also stops a running win lap, which is not a paused game.
      stopEverything();
      pauseGame();
    }
    // Runs inside the "back to game" click, so audio may be resumed here.
    else resumeGame();
  }

  // Background, lock or leaving the page. Safe to call repeatedly and in any phase.
  function onHide(): void {
    stopEverything();
    pauseGame();
  }

  // Back in the foreground: replay the stage only if the game screen is showing.
  // Not a user gesture, so the browser may keep sound blocked until the next press.
  function onShow(): void {
    if (screen === 'home') resumeGame();
  }

  return {
    start,
    pressPad,
    onScreenChange,
    onHide,
    onShow,
    get state(): GameState {
      return state;
    },
  };
}
