import { expect, test, type Page } from '@playwright/test';

const RESULT_KEY = 'simon:last-result:v1';

type Color = 'blue' | 'red' | 'yellow' | 'green';

const home = (page: Page) => page.locator('#screen-home');
const about = (page: Page) => page.locator('#screen-about');
const pad = (page: Page, color: Color) => page.locator(`.pad--${color}`);

// Records which pads light up during playback, read straight from the page (no hooks in the app).
function recordSequences() {
  const w = window as unknown as { __shown: string[]; __sequence: string[] };
  w.__shown = [];
  w.__sequence = [];
  // Lights are recorded synchronously, so repeated colors in one batch of timers are not merged.
  const toggle = DOMTokenList.prototype.toggle;
  DOMTokenList.prototype.toggle = function (token: string, force?: boolean) {
    const result = toggle.call(this, token, force);
    if (token === 'pad--lit' && force === true) {
      const board = document.getElementById('board');
      const color = board?.querySelector<HTMLElement>('.pad--lit')?.dataset.color;
      if (board?.dataset.phase === 'playback' && color) w.__shown.push(color);
    }
    return result;
  };
  new MutationObserver(() => {
    if (document.getElementById('board')?.dataset.phase === 'input' && w.__shown.length) {
      w.__sequence = w.__shown;
      w.__shown = [];
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-phase'] });
}

async function phase(page: Page): Promise<string | undefined> {
  return page.locator('#board').evaluate((el) => (el as HTMLElement).dataset.phase);
}

async function waitForPhase(page: Page, expected: string): Promise<void> {
  for (let i = 0; i < 200 && (await phase(page)) !== expected; i++) {
    await page.clock.runFor(100);
  }
  expect(await phase(page)).toBe(expected);
}

async function shownSequence(page: Page): Promise<Color[]> {
  return page.evaluate(() => (window as unknown as { __sequence: Color[] }).__sequence);
}

async function answerStage(page: Page): Promise<Color[]> {
  await waitForPhase(page, 'input');
  const sequence = await shownSequence(page);
  for (const color of sequence) await pad(page, color).click();
  return sequence;
}

function wrong(color: Color): Color {
  return color === 'blue' ? 'red' : 'blue';
}

async function openAbout(page: Page) {
  await page.getByRole('button', { name: 'אודות' }).click();
  await expect(about(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(recordSequences);
  await page.goto('./');
});

test('plays a full game to a win, then shows and keeps the result', async ({ page }) => {
  await page.getByRole('button', { name: 'התחל' }).click();
  for (let stage = 1; stage <= 10; stage++) {
    await waitForPhase(page, 'input');
    await expect(home(page).getByText(`שלב ${stage} מתוך 10 · תורכם`)).toBeVisible();
    const sequence = await answerStage(page);
    expect(sequence).toHaveLength(stage);
  }

  await expect(home(page).getByText('כל הכבוד! ניצחתם')).toBeVisible();
  await expect(home(page).getByText('10 מתוך 10')).toBeVisible();
  await expect(page.getByRole('button', { name: 'שחקו שוב' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'התחל' })).toBeHidden();

  // No 11th stage starts.
  await page.clock.runFor(5000);
  expect(await phase(page)).toBe('won');

  await openAbout(page);
  await expect(about(page).getByText('10 מתוך 10')).toBeVisible();

  await page.reload();
  await expect(home(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
  await openAbout(page);
  await expect(about(page).getByText('10 מתוך 10')).toBeVisible();
});

test('a mistake ends the game; play again restarts from stage 1', async ({ page }) => {
  await page.getByRole('button', { name: 'התחל' }).click();
  await answerStage(page);
  await waitForPhase(page, 'input');
  const [first] = await shownSequence(page);
  await pad(page, wrong(first)).click();

  await expect(home(page).getByText('טעות! המשחק נגמר')).toBeVisible();
  await expect(home(page).getByText('1 מתוך 10')).toBeVisible();

  // Input after the end changes nothing.
  await pad(page, first).click({ force: true });
  await expect(home(page).getByText('1 מתוך 10')).toBeVisible();

  await openAbout(page);
  await expect(about(page).getByText('1 מתוך 10')).toBeVisible();
  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await expect(home(page).getByText('טעות! המשחק נגמר')).toBeVisible();

  await page.getByRole('button', { name: 'שחקו שוב' }).click();
  await expect(home(page).getByText('שלב 1 מתוך 10 · צפו ברצף')).toBeVisible();
  await expect(page.getByRole('button', { name: 'שחקו שוב' })).toBeHidden();
});

test('a lower result replaces a higher one', async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, '{"schemaVersion":1,"score":9}'), RESULT_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'התחל' }).click();
  await waitForPhase(page, 'input');
  const [first] = await shownSequence(page);
  await pad(page, wrong(first)).click();
  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();
});

test('reload mid-game resets the game and keeps the saved result', async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, '{"schemaVersion":1,"score":5}'), RESULT_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'התחל' }).click();
  await answerStage(page);
  await waitForPhase(page, 'input');

  await page.reload();
  await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
  expect(await phase(page)).toBe('idle');
  await openAbout(page);
  await expect(about(page).getByText('5 מתוך 10')).toBeVisible();
});

test('leaving for about pauses; returning replays the same stage', async ({ page }) => {
  await page.getByRole('button', { name: 'התחל' }).click();
  await answerStage(page);
  await waitForPhase(page, 'input');
  const sequence = await shownSequence(page);
  await pad(page, sequence[0]).click();

  await openAbout(page);
  await page.clock.runFor(5000);
  expect(await phase(page)).toBe('paused');
  await expect(page.locator('.pad--lit')).toHaveCount(0);

  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await expect(home(page).getByText('שלב 2 מתוך 10 · צפו ברצף')).toBeVisible();
  await waitForPhase(page, 'input');
  expect(await shownSequence(page)).toEqual(sequence);

  // Partial input was reset: the full sequence is needed again.
  for (const color of sequence) await pad(page, color).click();
  await waitForPhase(page, 'input');
  await expect(home(page).getByText('שלב 3 מתוך 10 · תורכם')).toBeVisible();
});

test.describe('with a fixed color', () => {
  test.beforeEach(async ({ page }) => {
    // Every random pick is blue, so a duplicate press would complete the stage.
    await page.addInitScript(() => {
      Math.random = () => 0.1;
    });
    await page.reload();
  });

  test('ignores presses during playback', async ({ page }) => {
    await page.getByRole('button', { name: 'התחל' }).click();
    await waitForPhase(page, 'playback');
    await page.clock.runFor(900);
    await pad(page, 'red').click({ force: true });
    await pad(page, 'blue').click({ force: true });
    await waitForPhase(page, 'input');
    await expect(home(page).getByText('שלב 1 מתוך 10 · תורכם')).toBeVisible();
  });

  test('one tap registers exactly once', async ({ page }) => {
    await page.getByRole('button', { name: 'התחל' }).click();
    await waitForPhase(page, 'input');
    await pad(page, 'blue').tap();
    await waitForPhase(page, 'input');
    await expect(home(page).getByText('שלב 2 מתוך 10 · תורכם')).toBeVisible();
    await pad(page, 'blue').tap();
    await page.clock.runFor(300);
    expect(await phase(page)).toBe('input');
    await expect(home(page).getByText('שלב 2 מתוך 10 · תורכם')).toBeVisible();
  });

  test('keyboard activation registers exactly once', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Button focus via keyboard differs in WebKit');
    await page.getByRole('button', { name: 'התחל' }).click();
    await waitForPhase(page, 'input');
    await pad(page, 'blue').focus();
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'input');
    await page.keyboard.press('Enter');
    await page.clock.runFor(300);
    await expect(home(page).getByText('שלב 2 מתוך 10 · תורכם')).toBeVisible();
  });
});

test('corrupt saved data is shown as no result', async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), RESULT_KEY);
  await page.reload();
  await openAbout(page);
  await expect(about(page).getByText('עדיין אין תוצאה')).toBeVisible();
  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await expect(page.getByRole('button', { name: 'התחל' })).toBeEnabled();
});

test('blocked storage: the game continues and explains the result was not saved', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'התחל' }).click();
  await waitForPhase(page, 'input');
  const [first] = await shownSequence(page);
  await pad(page, wrong(first)).click();

  await expect(home(page).getByText('0 מתוך 10')).toBeVisible();
  await expect(home(page).getByText('לא ניתן לשמור את התוצאה במכשיר הזה.')).toBeVisible();
  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();
  await expect(about(page).getByText('התוצאה לא נשמרה במכשיר.')).toBeVisible();
});

test('without sound support the game continues with lights and a notice', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.AudioContext;
    delete w.webkitAudioContext;
  });
  await page.reload();
  await page.getByRole('button', { name: 'התחל' }).click();
  await expect(
    home(page).getByText('לא ניתן להשמיע צלילים. אפשר להמשיך לשחק עם האורות.'),
  ).toBeVisible();
  await answerStage(page);
  await waitForPhase(page, 'input');
  await expect(home(page).getByText('שלב 2 מתוך 10 · תורכם')).toBeVisible();
});

test('sound works after start (no notice)', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Headless WebKit has no audio output');
  await page.getByRole('button', { name: 'התחל' }).click();
  await page.clock.runFor(500);
  await expect(home(page).locator('#notice-audio')).toBeHidden();
});
