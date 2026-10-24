import { expect, type Page } from '@playwright/test';
import { pad, phase, RESULT_KEY, type Color } from '../helpers';

// Resolves once the service worker is active and every precache entry is stored.
export async function waitForPrecache(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (worker && worker.state !== 'activated') {
      await new Promise<void>((resolve) =>
        worker.addEventListener('statechange', () => worker.state === 'activated' && resolve()),
      );
    }
  });
  const expected = await precacheManifestSize(page);
  expect(expected).toBeGreaterThan(0);
  await expect.poll(() => precachedCount(page)).toBe(expected);
}

// Number of entries the current sw.js lists for precaching.
export async function precacheManifestSize(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const source = await (await fetch('sw.js', { cache: 'no-store' })).text();
    return (source.match(/url:"/g) ?? []).length;
  });
}

export async function precachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      if (!name.includes('precache')) continue;
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
}

async function precachedCount(page: Page): Promise<number> {
  return (await precachedUrls(page)).length;
}

export async function buildId(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.build);
}

// Counts oscillators so a test can tell that tones were actually played.
export function countTones() {
  const w = window as unknown as { __tones: number };
  w.__tones = 0;
  const create = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    w.__tones++;
    return create.call(this);
  };
}

export async function tones(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __tones: number }).__tones);
}

// Real-time wait (these tests do not install a fake clock, so the service worker runs normally).
export async function waitForPhaseRealTime(page: Page, expected: string): Promise<void> {
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe(expected);
}

// Starts a game and loses on stage 1 by pressing a color that was not shown.
export async function playShortGame(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'התחל' }).click();
  await waitForPhaseRealTime(page, 'input');
  const lit = await page.evaluate(
    () => (window as unknown as { __sequence: Color[] }).__sequence[0],
  );
  await pad(page, lit === 'blue' ? 'red' : 'blue').click();
  await waitForPhaseRealTime(page, 'lost');
}

export async function savedScore(page: Page): Promise<number | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { score: number }).score : null;
  }, RESULT_KEY);
}
