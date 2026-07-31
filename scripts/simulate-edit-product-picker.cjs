/**
 * Browser simulation: Product List → Edit Product → filter/select a Smart Component.
 *
 * Usage (against live):
 *   node scripts/simulate-edit-product-picker.cjs
 *
 * Usage (against local dist + live API proxy already on PORT):
 *   BASE_URL=http://127.0.0.1:5177 node scripts/simulate-edit-product-picker.cjs
 *
 * Requires: google-chrome + playwright-core (npm pack playwright-core && tar xf …).
 */
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE || '/tmp/package/index.js',
);
const fs = require('fs');

const BASE = process.env.BASE_URL || 'https://bisync-cloud-389272498937.asia-southeast1.run.app';
const EMAIL = process.env.BISYNC_EMAIL || 'dra@cubevalue.com';
const PASS = process.env.BISYNC_PASSWORD || 'Pass@123';
const SHOT = process.env.SHOT_DIR || '/opt/cursor/artifacts/screenshots';
const FILTER = process.env.COMPONENT_FILTER || 'Flour';

async function shot(page, name) {
  fs.mkdirSync(SHOT, { recursive: true });
  await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: false });
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.setDefaultTimeout(30000);

  await page.goto(`${BASE}/`);
  await page.waitForTimeout(700);
  await page.locator('header').getByText('Login', { exact: true }).first().click();
  const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Welcome back' }).first();
  await modal.waitFor({ state: 'visible' });
  await modal.locator('input').nth(0).fill(EMAIL);
  await modal.locator('input[type="password"]').fill(PASS);
  await modal.getByRole('button', { name: /^login$/i }).click();
  await page.waitForTimeout(2800);

  await page.locator('header select').first().selectOption({ label: /Weissbrau/i });
  await page.waitForTimeout(900);
  const locBtn = page.locator('header button').filter({ hasText: /Select locations|All Locations|location/i }).first();
  if (await locBtn.count()) {
    await locBtn.click();
    await page.waitForTimeout(250);
    await page.getByText('All Locations', { exact: true }).first().click();
    await page.mouse.click(40, 200);
  }

  const rms = page.getByRole('button', { name: /RMS/i }).first();
  if (await rms.isVisible().catch(() => false)) {
    await rms.click({ force: true });
    await page.waitForTimeout(1200);
  }

  await page.getByRole('button', { name: /^Products$/i }).first().click();
  await page.waitForTimeout(400);
  const menuPanel = page.locator('div.absolute.top-full').filter({ hasText: 'Product Audit' }).first();
  await menuPanel.getByRole('button', { name: /^Products$/i }).click();
  await page.waitForTimeout(2200);
  await shot(page, 'sim-product-list');

  await page.locator('table tbody tr').first().waitFor({ state: 'visible' });
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /^edit$/i }).first().click();
  await page.waitForTimeout(1800);
  await shot(page, 'sim-edit-product');

  const picker = page.locator('input[placeholder*="component" i]').first();
  await picker.waitFor({ state: 'visible' });
  await picker.scrollIntoViewIfNeeded();
  await picker.click();
  await picker.fill('');
  await picker.type(FILTER, { delay: 30 });
  await page.waitForTimeout(900);
  await shot(page, 'sim-picker-open');

  const menu = page.locator('[data-product-component-picker-menu], [data-smart-component-picker-menu]').first();
  await menu.waitFor({ state: 'visible' });
  const option = menu.locator('button').first();
  const optText = (await option.innerText()).replace(/\s+/g, ' ').trim();
  console.log('option', optText);
  await option.click();
  await page.waitForTimeout(1000);
  await shot(page, 'sim-after-select');

  const after = await picker.inputValue();
  const editHeading = await page.getByText(/Edit product/i).first().isVisible().catch(() => false);
  const detailHeading = await page.getByText(/Product details/i).first().isVisible().catch(() => false);
  console.log({ after, editHeading, detailHeading });

  if (!editHeading && detailHeading) {
    console.error('FAIL: ghost-click closed edit mode');
    process.exitCode = 3;
  } else if (!after || !/\(/.test(after)) {
    console.error('FAIL: selection did not stick');
    process.exitCode = 2;
  } else if (!new RegExp(FILTER, 'i').test(after)) {
    console.error('FAIL: selection did not match filter', FILTER, after);
    process.exitCode = 6;
  } else {
    console.log('PASS:', after);
  }

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
