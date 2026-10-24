import { COLORS, STAGE_COUNT, isFinished, type Color, type GameState } from './game/engine';

// All game messages shown in the UI. See ADR-8 in spec/ARCHITECTURE.md.
export const TEXT = {
  watch: (stage: number) => `שלב ${stage} מתוך ${STAGE_COUNT} · צפו ברצף`,
  yourTurn: (stage: number) => `שלב ${stage} מתוך ${STAGE_COUNT} · תורכם`,
  won: 'כל הכבוד! ניצחתם',
  lost: 'טעות! המשחק נגמר',
  score: (score: number) => `${score} מתוך ${STAGE_COUNT}`,
  noResult: 'עדיין אין תוצאה',
  notSaved: 'התוצאה לא נשמרה במכשיר.',
  saveFailed: 'לא ניתן לשמור את התוצאה במכשיר הזה.',
  audioFailed: 'לא ניתן להשמיע צלילים. אפשר להמשיך לשחק עם האורות.',
};

export interface GameView {
  render(state: GameState): void;
  /** Lights one pad, every pad ('all'), or none (null). */
  light(color: Color | 'all' | null): void;
  showLastResult(score: number | null, saved: boolean): void;
  setSaveNotice(visible: boolean): void;
  setAudioNotice(visible: boolean): void;
  focusPlayAgain(): void;
}

export interface ViewHandlers {
  onStart(): void;
  onPlayAgain(): void;
  onPad(color: Color): void;
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

function isColor(value: unknown): value is Color {
  return COLORS.includes(value as Color);
}

export function createDomView(handlers: ViewHandlers): GameView {
  const board = getElement('board');
  const pads = new Map<Color, HTMLButtonElement>();
  for (const color of COLORS) {
    pads.set(color, board.querySelector<HTMLButtonElement>(`[data-color="${color}"]`)!);
  }
  const status = getElement('game-status');
  const statusText = getElement('status-text');
  const gameOver = getElement('game-over');
  const gameOverMessage = getElement('game-over-message');
  const gameOverScore = getElement('game-over-score');
  const startButton = getElement<HTMLButtonElement>('start-button');
  const playAgainButton = getElement<HTMLButtonElement>('play-again-button');
  const saveNotice = getElement('notice-save');
  const audioNotice = getElement('notice-audio');
  const lastResult = getElement('last-result');
  const lastResultNote = getElement('last-result-note');

  saveNotice.textContent = TEXT.saveFailed;
  audioNotice.textContent = TEXT.audioFailed;
  lastResultNote.textContent = TEXT.notSaved;

  startButton.addEventListener('click', handlers.onStart);
  playAgainButton.addEventListener('click', handlers.onPlayAgain);

  // One input path: pointerdown for touch/mouse, click only for keyboard and assistive tech.
  // A single active pointer is accepted; other touches are ignored until it lifts.
  let activePointer: number | null = null;
  board.addEventListener('pointerdown', (event) => {
    const color = (event.target as Element).closest<HTMLElement>('[data-color]')?.dataset.color;
    if (!isColor(color) || activePointer !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    activePointer = event.pointerId;
    handlers.onPad(color);
  });
  const releasePointer = (event: PointerEvent) => {
    if (event.pointerId === activePointer) activePointer = null;
  };
  document.addEventListener('pointerup', releasePointer);
  document.addEventListener('pointercancel', releasePointer);
  board.addEventListener('click', (event) => {
    // detail === 0 means the click came from the keyboard, not from a pointer.
    if (event.detail !== 0) return;
    const color = (event.target as Element).closest<HTMLElement>('[data-color]')?.dataset.color;
    if (isColor(color)) handlers.onPad(color);
  });

  return {
    render(state) {
      const finished = isFinished(state);
      const stage = state.sequence.length;
      board.dataset.phase = state.phase;
      for (const pad of pads.values()) {
        // aria-disabled (not disabled) keeps keyboard focus on the pad between stages.
        pad.setAttribute('aria-disabled', String(state.phase !== 'input'));
      }

      startButton.hidden = state.phase !== 'idle';
      playAgainButton.hidden = !finished;

      const playing = state.phase === 'playback' || state.phase === 'input';
      statusText.hidden = !playing;
      statusText.textContent = !playing
        ? ''
        : state.phase === 'input'
          ? TEXT.yourTurn(stage)
          : TEXT.watch(stage);
      statusText.classList.toggle('game-status__text--turn', state.phase === 'input');

      gameOver.hidden = !finished;
      if (finished) {
        gameOverMessage.textContent = state.phase === 'won' ? TEXT.won : TEXT.lost;
        gameOverScore.textContent = TEXT.score(state.completedStages);
      }
      status.hidden = !playing && !finished;
    },

    light(color) {
      for (const [name, pad] of pads) pad.classList.toggle('pad--lit', color === 'all' || name === color);
    },

    showLastResult(score, saved) {
      lastResult.textContent = score === null ? TEXT.noResult : TEXT.score(score);
      lastResult.className = score === null ? 'result-card__empty' : 'result-card__score';
      lastResultNote.hidden = score === null || saved;
    },

    setSaveNotice(visible) {
      saveNotice.hidden = !visible;
    },

    setAudioNotice(visible) {
      audioNotice.hidden = !visible;
    },

    focusPlayAgain() {
      playAgainButton.focus();
    },
  };
}
