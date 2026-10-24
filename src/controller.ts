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
import { PRESS_FLASH_MS, ROUND_PAUSE_MS } from './game/timing';
import type { Screen } from './navigation';
import type { Scheduler, SequencePlayer } from './sequence-player';
import type { GameView } from './view';

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
  }

  function start(): void {
    audio.unlock();
    stopEverything();
    view.setSaveNotice(false);
    state = newGame(rng);
    void runStage();
  }

  function pressPad(color: Color): void {
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

  function onScreenChange(screen: Screen): void {
    if (screen === 'about' && isActive(state)) {
      stopEverything();
      state = pause(state);
      view.render(state);
    } else if (screen === 'home' && state.phase === 'paused') {
      // Runs inside the "back to game" click, so audio may be resumed here.
      audio.unlock();
      state = resume(state);
      void runStage();
    }
  }

  return {
    start,
    pressPad,
    onScreenChange,
    get state(): GameState {
      return state;
    },
  };
}
