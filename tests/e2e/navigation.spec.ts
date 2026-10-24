import { expect, test, type Page } from '@playwright/test';

const INSTRUCTIONS = [
  'צפו ברצף וחזרו עליו בלחיצה על הצבעים.',
  'בכל שלב נוסף צבע לרצף.',
  'השלימו 10 שלבים כדי לנצח.',
  'טעות אחת מסיימת את המשחק.',
  'אין הגבלת זמן לתשובה.',
];

const home = (page: Page) => page.locator('#screen-home');
const about = (page: Page) => page.locator('#screen-about');

async function hasNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('home screen shows the board and an enabled start button', async ({ page }) => {
  await expect(page).toHaveTitle('סיימון');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');

  await expect(home(page).getByRole('heading', { level: 1, name: 'סיימון' })).toBeVisible();
  await expect(home(page).getByText('משחק זיכרון עם אורות וצלילים')).toBeVisible();
  for (const name of ['כחול', 'אדום', 'צהוב', 'ירוק']) {
    await expect(home(page).getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'התחל' })).toBeEnabled();
  await expect(about(page)).toBeHidden();
});

test('navigates home → about → home without reloading', async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });

  await page.getByRole('button', { name: 'אודות' }).click();
  await expect(home(page)).toBeHidden();
  await expect(about(page).getByRole('heading', { level: 1, name: 'אודות' })).toBeFocused();
  await expect(about(page).getByText('סיימון הוא משחק זיכרון עם אורות וצלילים.')).toBeVisible();
  await expect(about(page).getByRole('heading', { name: 'איך משחקים?' })).toBeVisible();
  for (const line of INSTRUCTIONS) {
    await expect(about(page).getByText(line, { exact: true })).toBeVisible();
  }
  await expect(about(page).getByText('תוצאת המשחק האחרון')).toBeVisible();
  await expect(about(page).getByText('עדיין אין תוצאה')).toBeVisible();
  await expect(page.getByText('7 מתוך 10')).toHaveCount(0);

  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await expect(about(page)).toBeHidden();
  await expect(home(page).getByRole('heading', { level: 1, name: 'סיימון' })).toBeFocused();

  const stillSamePage = await page.evaluate(
    () => (window as unknown as { __noReload?: boolean }).__noReload === true,
  );
  expect(stillSamePage).toBe(true);
});

test('reload always opens the home screen', async ({ page }) => {
  await page.getByRole('button', { name: 'אודות' }).click();
  await expect(about(page)).toBeVisible();
  await page.reload();
  await expect(home(page)).toBeVisible();
  await expect(about(page)).toBeHidden();
});

test('board is round with fixed colour positions', async ({ page }) => {
  const board = await page.locator('.board').boundingBox();
  expect(board).not.toBeNull();
  expect(Math.abs(board!.width - board!.height)).toBeLessThan(1);

  const box = async (color: string) => (await page.locator(`.pad--${color}`).boundingBox())!;
  const red = await box('red');
  const blue = await box('blue');
  const green = await box('green');
  const yellow = await box('yellow');

  // Top-left red, top-right blue, bottom-left green, bottom-right yellow.
  expect(red.x).toBeLessThan(blue.x);
  expect(green.x).toBeLessThan(yellow.x);
  expect(red.y).toBeLessThan(green.y);
  expect(blue.y).toBeLessThan(yellow.y);
});

test('touch targets are at least 48px', async ({ page }) => {
  for (const name of ['אודות', 'התחל']) {
    const target = await page.getByRole('button', { name }).boundingBox();
    expect(target!.width).toBeGreaterThanOrEqual(48);
    expect(target!.height).toBeGreaterThanOrEqual(48);
  }
});

for (const width of [320, 390]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    await page.getByRole('button', { name: 'אודות' }).click();
    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });
}

test('keyboard focus never reaches the hidden screen', async ({ page, browserName }) => {
  // WebKit skips buttons in the tab order by default (macOS setting), so use Chromium here.
  test.skip(browserName === 'webkit', 'Tab order for buttons differs in WebKit');

  const focusedScreens = async (presses: number) => {
    const screens: (string | null)[] = [];
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press('Tab');
      screens.push(
        await page.evaluate(() => document.activeElement?.closest('.screen')?.id ?? null),
      );
    }
    return screens;
  };

  expect(await focusedScreens(4)).not.toContain('screen-about');

  await page.getByRole('button', { name: 'אודות' }).click();
  expect(await focusedScreens(4)).not.toContain('screen-home');
});

test('loads no resources from other origins', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) external.push(request.url());
  });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'אודות' }).click();
  expect(external).toEqual([]);
});
