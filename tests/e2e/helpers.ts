import { expect, type Page } from '@playwright/test';

export const RESULT_KEY = 'simon:last-result:v1';

export type Color = 'blue' | 'red' | 'yellow' | 'green';

export const home = (page: Page) => page.locator('#screen-home');
export const about = (page: Page) => page.locator('#screen-about');
export const pad = (page: Page, color: Color) => page.locator(`.pad--${color}`);

// Records which pads light up during playback, read straight from the page (no hooks in the app).
export function recordSequences() {
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
    const current = document.getElementById('board')?.dataset.phase;
    // A paused playback is replayed from the start, so its partial lights are dropped.
    if (current === 'paused') w.__shown = [];
    if (current === 'input' && w.__shown.length) {
      w.__sequence = w.__shown;
      w.__shown = [];
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-phase'] });
}

export async function phase(page: Page): Promise<string | undefined> {
  return page.locator('#board').evaluate((el) => (el as HTMLElement).dataset.phase);
}

export async function waitForPhase(page: Page, expected: string): Promise<void> {
  for (let i = 0; i < 200 && (await phase(page)) !== expected; i++) {
    await page.clock.runFor(100);
  }
  expect(await phase(page)).toBe(expected);
}

export async function shownSequence(page: Page): Promise<Color[]> {
  return page.evaluate(() => (window as unknown as { __sequence: Color[] }).__sequence);
}

export async function answerStage(page: Page): Promise<Color[]> {
  await waitForPhase(page, 'input');
  const sequence = await shownSequence(page);
  for (const color of sequence) await pad(page, color).click();
  return sequence;
}

export function wrong(color: Color): Color {
  return color === 'blue' ? 'red' : 'blue';
}

export async function openAbout(page: Page) {
  await page.getByRole('button', { name: 'אודות' }).click();
  await expect(about(page)).toBeVisible();
}
