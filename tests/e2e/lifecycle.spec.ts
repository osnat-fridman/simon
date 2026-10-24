import { expect, test, type Page } from '@playwright/test';
import {
  RESULT_KEY,
  about,
  answerStage,
  home,
  openAbout,
  pad,
  phase,
  recordSequences,
  shownSequence,
  waitForPhase,
  wrong,
} from './helpers';

// Background and back/forward cache are simulated from inside the page; see ADR-11.
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (isHidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => isHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

async function goToBackground(page: Page): Promise<void> {
  await setHidden(page, true);
}

async function comeBack(page: Page): Promise<void> {
  await setHidden(page, false);
}

async function litCount(page: Page): Promise<number> {
  return page.locator('.pad--lit').count();
}

// Runs the clock and fails if any pad lights up meanwhile.
async function expectDarkFor(page: Page, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 100) {
    await page.clock.runFor(100);
    expect(await litCount(page)).toBe(0);
  }
}

async function startAndReachInput(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'התחל' }).click();
  await waitForPhase(page, 'input');
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(recordSequences);
  await page.goto('./');
});

test('background mid-playback stops the lights; returning replays the same stage', async ({
  page,
}) => {
  await startAndReachInput(page);
  const first = await shownSequence(page);
  for (const color of first) await pad(page, color).click();
  // Stage 2 is now being shown.
  await page.clock.runFor(1000);
  expect(await phase(page)).toBe('playback');

  await goToBackground(page);
  expect(await phase(page)).toBe('paused');
  await expectDarkFor(page, 5000);
  expect(await phase(page)).toBe('paused');

  await comeBack(page);
  await expect(home(page).getByText('שלב 2 מתוך 10 · צפו ברצף')).toBeVisible();
  await waitForPhase(page, 'input');
  const second = await shownSequence(page);
  expect(second).toHaveLength(2);
  expect(second[0]).toBe(first[0]);
});

test('background mid-answer clears the partial answer and keeps the score', async ({ page }) => {
  await startAndReachInput(page);
  await answerStage(page);
  await waitForPhase(page, 'input');
  const sequence = await shownSequence(page);
  await pad(page, sequence[0]).click();

  await goToBackground(page);
  await comeBack(page);
  await expect(home(page).getByText('שלב 2 מתוך 10 · צפו ברצף')).toBeVisible();
  await waitForPhase(page, 'input');
  expect(await shownSequence(page)).toEqual(sequence);

  // The full sequence is needed again; one color would not finish the stage.
  for (const color of sequence) await pad(page, color).click();
  await waitForPhase(page, 'input');
  await expect(home(page).getByText('שלב 3 מתוך 10 · תורכם')).toBeVisible();
});

test('returning while about is showing keeps the game paused', async ({ page }) => {
  await startAndReachInput(page);
  const sequence = await shownSequence(page);
  await openAbout(page);
  await goToBackground(page);
  await comeBack(page);
  await expectDarkFor(page, 3000);
  expect(await phase(page)).toBe('paused');

  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await waitForPhase(page, 'input');
  expect(await shownSequence(page)).toEqual(sequence);
});

test('background before a game or after it ends starts nothing', async ({ page }) => {
  await goToBackground(page);
  await comeBack(page);
  await page.clock.runFor(3000);
  expect(await phase(page)).toBe('idle');
  await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();

  await startAndReachInput(page);
  const [color] = await shownSequence(page);
  await pad(page, wrong(color)).click();
  await expect(home(page).getByText('טעות! המשחק נגמר')).toBeVisible();
  const saved = await page.evaluate((key) => localStorage.getItem(key), RESULT_KEY);

  await goToBackground(page);
  await comeBack(page);
  await page.clock.runFor(3000);
  expect(await phase(page)).toBe('lost');
  await expect(home(page).getByText('טעות! המשחק נגמר')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), RESULT_KEY)).toBe(saved);
  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();
});

test('rapid repeated switching shows the sequence once and keeps the score', async ({ page }) => {
  await startAndReachInput(page);
  await answerStage(page);
  await page.clock.runFor(1000);

  for (let i = 0; i < 4; i++) {
    await goToBackground(page);
    await comeBack(page);
  }
  await openAbout(page);
  await goToBackground(page);
  await comeBack(page);
  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await comeBack(page);

  await waitForPhase(page, 'input');
  const sequence = await shownSequence(page);
  expect(sequence).toHaveLength(2);
  await expect(home(page).getByText('שלב 2 מתוך 10 · תורכם')).toBeVisible();
  // No second playback is still queued.
  await expectDarkFor(page, 5000);
  expect(await phase(page)).toBe('input');
});

test('restore from the back/forward cache runs no stale timers', async ({ page }) => {
  await startAndReachInput(page);
  await answerStage(page);
  await page.clock.runFor(1000);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  });
  expect(await phase(page)).toBe('paused');
  await expectDarkFor(page, 3000);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  expect(await phase(page)).toBe('playback');
  // The replay starts with the fixed opening pause, not mid-sequence.
  await expectDarkFor(page, 700);
  await waitForPhase(page, 'input');
  expect(await shownSequence(page)).toHaveLength(2);
});

test.describe('when the browser blocks sound after returning', () => {
  test.beforeEach(async ({ page }) => {
    // Fake AudioContext: it suspends in the background (like iOS) and resumes only during a
    // user gesture, as browsers do.
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      let gesture = false;
      for (const type of ['pointerdown', 'click']) {
        window.addEventListener(type, () => (gesture = true), true);
        window.addEventListener(type, () => (gesture = false));
      }
      w.__tones = 0;
      class FakeAudioContext extends EventTarget {
        state = 'suspended';
        currentTime = 0;
        destination = {};
        constructor() {
          super();
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.setState('interrupted');
          });
        }
        setState(state: string) {
          this.state = state;
          this.dispatchEvent(new Event('statechange'));
        }
        resume() {
          if (!gesture) return new Promise(() => {});
          this.setState('running');
          return Promise.resolve();
        }
        createOscillator() {
          return {
            frequency: {},
            connect: (node: unknown) => node,
            start: () => (w.__tones = (w.__tones as number) + 1),
            stop() {},
          };
        }
        createGain() {
          const param = { setValueAtTime() {}, linearRampToValueAtTime() {} };
          return { gain: param, connect: (node: unknown) => node };
        }
      }
      w.AudioContext = FakeAudioContext;
    });
    await page.reload();
  });

  test('lights continue with a Hebrew notice; the next press brings sound back', async ({
    page,
  }) => {
    const notice = home(page).getByText('לא ניתן להשמיע צלילים. אפשר להמשיך לשחק עם האורות.');
    const tones = () => page.evaluate(() => (window as unknown as { __tones: number }).__tones);

    await startAndReachInput(page);
    await expect(notice).toBeHidden();
    expect(await tones()).toBe(1);

    await goToBackground(page);
    await comeBack(page);
    await waitForPhase(page, 'input');
    await expect(notice).toBeVisible();
    expect(await tones()).toBe(1);

    // The game is not blocked: the stage can be answered, and that press resumes sound.
    const [color] = await shownSequence(page);
    await pad(page, color).click();
    await expect(notice).toBeHidden();
    expect(await tones()).toBe(2);
    await waitForPhase(page, 'input');
    await expect(home(page).getByText('שלב 2 מתוך 10 · תורכם')).toBeVisible();
    expect(await tones()).toBe(4);
  });
});
