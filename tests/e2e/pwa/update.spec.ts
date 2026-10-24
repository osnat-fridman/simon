import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { about, home, openAbout, RESULT_KEY, recordSequences } from '../helpers';
import { buildId, playShortGame, precachedUrls, savedScore, waitForPrecache } from './helpers';
import { startStaticServer, type StaticServer } from './static-server';

// Two real production builds that differ only in their build id, served by a switchable server.
const PORT = 4174;
const URL_HOME = `http://localhost:${PORT}/simon/`;
const DIST_A = 'dist-a';
const DIST_B = 'dist-b';

let server: StaticServer;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  for (const [id, outDir] of [
    ['a', DIST_A],
    ['b', DIST_B],
  ]) {
    execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
      env: { ...process.env, SIMON_BUILD_ID: id },
      stdio: 'ignore',
    });
  }
  server = await startStaticServer(PORT, '/simon/', DIST_A);
});

test.afterAll(async () => {
  await server?.close();
});

test.beforeEach(async ({ context }) => {
  server.setRoot(DIST_A);
  server.failPath(null);
  await context.addInitScript(recordSequences);
});

async function scriptAssets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map((s) => s.src),
  );
}

test('a new version waits, does not interrupt the game, and activates after old tabs close', async ({
  context,
  page,
}) => {
  test.setTimeout(60_000);

  // Version a installed and controlling the page.
  await page.goto(URL_HOME);
  await waitForPrecache(page);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  expect(await buildId(page)).toBe('a');
  const oldAssets = await scriptAssets(page);
  await page.evaluate(() => ((window as unknown as { __same: boolean }).__same = true));

  // Game in progress while version b is deployed and detected.
  await page.getByRole('button', { name: 'התחל' }).click();
  server.setRoot(DIST_B);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.waiting?.state ?? registration?.installing?.state ?? null;
      }),
    )
    .toBe('installed');

  // Same page, same version, no reload: the game finishes and the result is saved.
  expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(true);
  expect(await buildId(page)).toBe('a');
  await page.waitForFunction(() => document.getElementById('board')?.dataset.phase === 'input');
  await page.evaluate(() => {
    // Lose deterministically regardless of the shown color.
    const w = window as unknown as { __sequence: string[] };
    const wrong = w.__sequence[0] === 'blue' ? 'red' : 'blue';
    document
      .querySelector(`.pad--${wrong}`)!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
  });
  await page.waitForFunction(() => document.getElementById('board')?.dataset.phase === 'lost');
  expect(await savedScore(page)).toBe(0);
  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();

  // A second tab still gets the old version while the old one is in use.
  const second = await context.newPage();
  await second.goto(URL_HOME);
  expect(await buildId(second)).toBe('a');
  expect(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())!.waiting),
  ).toBe(true);

  // Close every old client; the waiting version activates on its own.
  await second.close();
  await page.close();
  const fresh = await context.newPage();
  await expect
    .poll(
      async () => {
        await fresh.goto(URL_HOME);
        return buildId(fresh);
      },
      { timeout: 15_000 },
    )
    .toBe('b');

  // The saved result survived, and only version b's files remain precached.
  expect(await savedScore(fresh)).toBe(0);
  expect(await fresh.evaluate((key) => localStorage.getItem(key), RESULT_KEY)).not.toBeNull();
  await openAbout(fresh);
  await expect(about(fresh).getByText('0 מתוך 10')).toBeVisible();
  await waitForPrecache(fresh);
  const cached = await precachedUrls(fresh);
  for (const asset of oldAssets) expect(cached.some((url) => url.startsWith(asset))).toBe(false);
});

test('a failed precache does not break the loaded game and promises nothing', async ({
  context,
  page,
}) => {
  test.setTimeout(60_000);
  server.failPath('/simon/icons/icon-512.png');

  await page.goto(URL_HOME);
  // The worker tried to precache the failing file, and installation failed: no worker remains.
  await expect.poll(() => server.failedHits(), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration?.installing) return 'installing';
          return registration?.active ? 'active' : 'none';
        }),
      { timeout: 15_000 },
    )
    .toBe('none');
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();

  await playShortGame(page);
  expect(await savedScore(page)).toBe(0);
  await expect(home(page)).not.toContainText(/offline|אופליין|ללא אינטרנט/i);
  await openAbout(page);
  await expect(about(page).getByText('0 מתוך 10')).toBeVisible();

  // Without a completed precache, opening offline is not possible (and was never promised).
  await context.setOffline(true);
  await expect(page.reload()).rejects.toThrow();
});
