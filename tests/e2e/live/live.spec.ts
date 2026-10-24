import { expect, test } from '@playwright/test';
import { about, home, openAbout, phase, recordSequences } from '../helpers';
import {
  buildId,
  countTones,
  playShortGame,
  savedScore,
  tones,
  waitForPrecache,
  waitForPhaseRealTime,
} from '../pwa/helpers';

// Checks the deployed site. Runs only with SIMON_LIVE_URL set (npm run test:live), never in CI.

test.beforeEach(async ({ context }) => {
  await context.addInitScript(recordSequences);
  await context.addInitScript(countTones);
});

test('the live site loads every resource under /simon/ with no errors', async ({
  page,
  request,
  baseURL,
}) => {
  const base = new URL(baseURL!);
  const failed: string[] = [];
  const external: string[] = [];
  const errors: string[] = [];
  page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  page.on('requestfailed', (r) => failed.push(`failed ${r.url()}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.context().on('request', (r) => {
    if (new URL(r.url()).origin !== base.origin) external.push(r.url());
  });

  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  if (base.hostname !== 'localhost') expect(base.protocol).toBe('https:');
  await expect(home(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('800 16px Heebo', 'סיימון'))).toBe(true);

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe(`${base.pathname}manifest.webmanifest`);
  const manifest = await (await request.get(new URL(href!, base).href)).json();
  expect(manifest).toMatchObject({
    id: base.pathname,
    start_url: base.pathname,
    scope: base.pathname,
    display: 'standalone',
  });
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(new URL(icon.src, new URL(href!, base)).href)).status()).toBe(200);
  }

  await waitForPrecache(page);
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.getRegistration())?.scope,
  );
  expect(scope).toBe(base.href);

  await openAbout(page);
  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await expect(home(page)).toBeVisible();

  expect(failed).toEqual([]);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('after precache, the live site plays offline and keeps the result', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await waitForPrecache(page);
  await context.setOffline(true);
  await page.reload();
  await expect(home(page)).toBeVisible();

  await playShortGame(page);
  expect(await tones(page)).toBeGreaterThan(0);
  expect(await savedScore(page)).toBe(0);
  await page.reload();
  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();
});

// Start this, then push a new version to main: it waits for that deploy to reach the site.
test('a new live version waits during a game and activates after the tab closes', async ({
  context,
}) => {
  test.skip(process.env.SIMON_LIVE_UPDATE !== '1', 'Set SIMON_LIVE_UPDATE=1 and deploy a new version');
  test.setTimeout(20 * 60_000);

  const page = await context.newPage();
  await page.goto('./');
  await waitForPrecache(page);
  await page.reload();
  const oldId = await buildId(page);
  console.log(`Live version before: ${oldId}`);

  await page.getByRole('button', { name: 'התחל' }).click();
  await waitForPhaseRealTime(page, 'input');

  // Ask the browser to check for a new service worker until the next deploy shows up.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          await registration?.update().catch(() => undefined);
          // Waiting means the new version is fully downloaded and ready to take over.
          return Boolean(registration?.waiting);
        }),
      { timeout: 18 * 60_000, intervals: [15_000] },
    )
    .toBe(true);

  // The new version waits; the running game is untouched.
  expect(await buildId(page)).toBe(oldId);
  expect(await phase(page)).toBe('input');
  const lit = await page.evaluate(
    () => (window as unknown as { __sequence: string[] }).__sequence[0],
  );
  await page.locator(`.pad--${lit === 'blue' ? 'red' : 'blue'}`).click();
  await waitForPhaseRealTime(page, 'lost');
  expect(await savedScore(page)).toBe(0);

  // Closing the only tab lets the new version take over. Like a user, close and reopen:
  // a reload would keep the old version in control, since the page never fully goes away.
  await page.close();
  let next = await context.newPage();
  await expect
    .poll(
      async () => {
        await next.close();
        next = await context.newPage();
        await next.goto('./');
        return buildId(next);
      },
      { timeout: 30_000, intervals: [2_000] },
    )
    .not.toBe(oldId);
  console.log(`Live version after: ${await buildId(next)}`);
  expect(await savedScore(next)).toBe(0);
  await openAbout(next);
  await expect(about(next).getByText('0 מתוך 10')).toBeVisible();
});
