import { expect, test } from '@playwright/test';
import { about, home, openAbout, recordSequences } from '../helpers';
import {
  countTones,
  playShortGame,
  savedScore,
  tones,
  waitForPrecache,
  waitForPhaseRealTime,
} from './helpers';

// Runs against the production build served by `vite preview` (see playwright.config.ts).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(recordSequences);
  await page.addInitScript(countTones);
  await page.goto('./');
});

test('manifest, icons and paths stay under /simon/', async ({ page, request, baseURL }) => {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/simon/manifest.webmanifest');
  const manifestUrl = new URL(href!, baseURL);
  const manifest = await (await request.get(manifestUrl.href)).json();

  expect(manifest).toMatchObject({
    id: '/simon/',
    start_url: '/simon/',
    scope: '/simon/',
    name: 'סיימון',
    short_name: 'סיימון',
    lang: 'he',
    dir: 'rtl',
    display: 'standalone',
  });

  const icons = manifest.icons as { src: string; sizes: string; purpose?: string }[];
  expect(icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
  expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

  const iconUrls = [
    ...icons.map((icon) => new URL(icon.src, manifestUrl).href),
    new URL('/simon/icons/apple-touch-icon.png', baseURL).href,
  ];
  for (const url of iconUrls) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  const size = (url: string) =>
    page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, url);
  expect(await size(iconUrls[0])).toBe('192x192');
  expect(await size(iconUrls[1])).toBe('512x512');
  expect(await size(iconUrls[3])).toBe('180x180');
  expect((await request.get(new URL('/simon/favicon.svg', baseURL).href)).status()).toBe(200);
});

test('service worker scope is limited to /simon/', async ({ page }) => {
  await waitForPrecache(page);
  const scopes = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const root = await navigator.serviceWorker.getRegistration('/');
    return { scope: registration?.scope, root: root?.scope ?? null };
  });
  expect(new URL(scopes.scope!).pathname).toBe('/simon/');
  expect(scopes.root).toBeNull();
});

test('after precache, the full game works offline across reloads', async ({ page, context }) => {
  await waitForPrecache(page);
  await context.setOffline(true);
  await page.reload();

  await expect(home(page)).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('800 16px Heebo', 'סיימון'))).toBe(true);

  await playShortGame(page);
  expect(await tones(page)).toBeGreaterThan(0);
  await expect(home(page).getByText('טעות! המשחק נגמר')).toBeVisible();
  expect(await savedScore(page)).toBe(0);

  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();

  await page.reload();
  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();
  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await expect(home(page)).toBeVisible();
});

test('no request leaves the site while loading and playing', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.context().on('request', (request) => {
    if (new URL(request.url()).origin !== origin) external.push(request.url());
  });
  await waitForPrecache(page);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await playShortGame(page);
  await openAbout(page);
  expect(external).toEqual([]);
});

test('clearing site data mid-game does not break the loaded game', async ({
  page,
  context,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await waitForPrecache(page);

  await page.getByRole('button', { name: 'התחל' }).click();
  await waitForPhaseRealTime(page, 'input');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Storage.clearDataForOrigin', {
    origin: new URL(baseURL!).origin,
    storageTypes: 'cache_storage,service_workers,local_storage',
  });
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBe(0);

  const lit = await page.evaluate(
    () => (window as unknown as { __sequence: string[] }).__sequence[0],
  );
  await page.locator(`.pad--${lit === 'blue' ? 'red' : 'blue'}`).click();
  await waitForPhaseRealTime(page, 'lost');
  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/offline|אופליין|ללא אינטרנט/i);
  expect(errors).toEqual([]);

  // Back online, a reload installs the service worker again.
  await page.reload();
  await waitForPrecache(page);
});
