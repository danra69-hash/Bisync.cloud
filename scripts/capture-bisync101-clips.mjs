#!/usr/bin/env node
/**
 * Capture Bisync101 clips from the live Bisync.cloud UI (not Pillow mocks).
 *
 * Records real screens at 960×540 with a visible demo cursor, mouse moves to
 * each control, and typed example values — then writes silent VP9 WebMs to
 * client/public/bisync101/clips/.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5173 \
 *   BISYNC_EMAIL=dra@cubevalue.com \
 *   BISYNC_PASSWORD='Pass@123' \
 *   node scripts/capture-bisync101-clips.mjs
 *
 * Optional:
 *   ONLY=gs-sign-in,rms-create-po   # limit to clip ids / filenames
 *   COMPANY='Weissbrau Sdn. Bhd.'
 *   PLAYWRIGHT_BROWSERS_PATH=…      # if using a local playwright install
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'client/public/bisync101/clips');
const W = 960;
const H = 540;

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const EMAIL = process.env.BISYNC_EMAIL || 'dra@cubevalue.com';
const PASSWORD = process.env.BISYNC_PASSWORD || 'Pass@123';
const COMPANY = process.env.COMPANY || 'Weissbrau Sdn. Bhd.';
const ONLY = new Set(
  (process.env.ONLY || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\.webm$/i, '')),
);

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.join(ROOT, 'node_modules/playwright'),
    path.join(os.tmpdir(), 'bisync101-capture/node_modules/playwright'),
    'playwright',
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'playwright not found. Run: mkdir -p /tmp/bisync101-capture && cd /tmp/bisync101-capture && npm i playwright@1.49.1 && npx playwright install chromium',
  );
}

async function injectDemoChrome(page) {
  await page.addInitScript(() => {
    const ensure = () => {
      if (document.getElementById('bisync101-demo-cursor')) return;
      const cursor = document.createElement('div');
      cursor.id = 'bisync101-demo-cursor';
      cursor.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'width:16px',
        'height:16px',
        'left:0',
        'top:0',
        'border-radius:50% 0 50% 50%',
        'background:#F37021',
        'border:2px solid #fff',
        'box-shadow:0 2px 8px rgba(0,0,0,.35)',
        'pointer-events:none',
        'transform:translate(-2px,-2px) rotate(-20deg)',
        'transition:left 50ms linear, top 50ms linear',
      ].join(';');
      document.documentElement.appendChild(cursor);

      const caption = document.createElement('div');
      caption.id = 'bisync101-demo-caption';
      caption.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'bottom:12px',
        'z-index:2147483646',
        'padding:10px 14px',
        'border-radius:10px',
        'background:rgba(42,33,24,.92)',
        'color:#fff',
        'font:600 13px/1.35 system-ui,sans-serif',
        'pointer-events:none',
        'box-shadow:0 8px 24px rgba(0,0,0,.28)',
      ].join(';');
      caption.textContent = 'Bisync101 · live demo';
      document.documentElement.appendChild(caption);

      window.addEventListener(
        'mousemove',
        e => {
          cursor.style.left = `${e.clientX}px`;
          cursor.style.top = `${e.clientY}px`;
        },
        { passive: true },
      );
      window.__bisync101SetCaption = text => {
        caption.textContent = text || 'Bisync101 · live demo';
      };
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensure);
    } else {
      ensure();
    }
  });
}

async function setCaption(page, text) {
  await page.evaluate(t => {
    if (typeof window.__bisync101SetCaption === 'function') window.__bisync101SetCaption(t);
  }, text);
}

async function moveTo(page, locator, steps = 18) {
  const handle = locator.first();
  if (!(await handle.count())) return null;
  await handle.scrollIntoViewIfNeeded().catch(() => {});
  const box = await handle.boundingBox();
  if (!box) return null;
  const x = box.x + Math.min(box.width * 0.45, Math.max(12, box.width / 2));
  const y = box.y + Math.min(box.height * 0.5, Math.max(10, box.height / 2));
  await page.mouse.move(x, y, { steps });
  return { x, y };
}

async function clickLoc(page, locator) {
  const handle = locator.first();
  await moveTo(page, handle);
  await page.waitForTimeout(180);
  try {
    await handle.click({ timeout: 5000 });
  } catch {
    await handle.click({ force: true, timeout: 5000 });
  }
}

async function typeInto(page, locator, text, { clear = true } = {}) {
  const handle = locator.first();
  if (!(await handle.count())) return false;
  await clickLoc(page, handle).catch(async () => {
    await handle.click({ force: true });
  });
  if (clear) {
    await handle.fill('').catch(() => {});
  }
  await handle.pressSequentially(String(text), { delay: 55 }).catch(async () => {
    await handle.fill(String(text));
  });
  return true;
}

async function login(page) {
  await setCaption(page, 'STEP 1 · Open Login');
  await clickLoc(page, page.getByRole('banner').getByRole('button', { name: 'Login' }));
  await page.waitForSelector('#login-email');
  await setCaption(page, 'STEP 2 · Type email example');
  await typeInto(page, page.locator('#login-email'), EMAIL);
  await setCaption(page, 'STEP 3 · Type password example');
  await typeInto(page, page.locator('#login-password'), PASSWORD);
  await setCaption(page, 'STEP 4 · Submit sign-in');
  await clickLoc(page, page.getByRole('dialog').locator('button[type="submit"]'));
  await page.waitForTimeout(2200);
}

async function selectCompany(page, companyName) {
  const company = page.locator('header select').first();
  await moveTo(page, company);
  await company.selectOption({ label: companyName }).catch(async () => {
    await company.selectOption({ label: new RegExp(companyName.split(/\s+/)[0], 'i') });
  });
  await page.waitForTimeout(1200);
}

async function scopeOrg(page) {
  await setCaption(page, 'Select company');
  await selectCompany(page, COMPANY);
  // Single-outlet companies auto-select; otherwise open location picker.
  const locLabel = page.locator('header').getByText(/All Locations|Select location/i).first();
  if (await locLabel.count()) {
    await setCaption(page, 'Confirm location scope');
    await moveTo(page, locLabel);
    await page.waitForTimeout(500);
  }
}

async function goHome(page) {
  const homeBtn = page.locator('header button').filter({ has: page.locator('svg.lucide-home') }).first();
  if (await homeBtn.count()) {
    await clickLoc(page, homeBtn).catch(() => homeBtn.click({ force: true }));
  } else {
    await page.locator('header').getByText('Bisync.').first().click().catch(() => {});
  }
  await page.waitForTimeout(800);
}

async function openModuleTile(page, label) {
  await goHome(page);
  await setCaption(page, `Open ${label}`);
  const main = page.locator('[data-app-main], main').first();
  const tile = main.locator(`button[title="${label}"]`).first()
    .or(main.getByRole('button', { name: label }).first())
    .or(main.locator('button').filter({ hasText: label }).first());
  await moveTo(page, tile);
  await page.waitForTimeout(200);
  await tile.click({ force: true, timeout: 8000 });
  await page.waitForTimeout(1200);
}

async function openSidebarNav(page, moduleName) {
  await setCaption(page, 'Open sidebar menu');
  const menu = page.locator('header button').first();
  await clickLoc(page, menu);
  await page.waitForTimeout(500);
  await setCaption(page, `Navigate · ${moduleName}`);
  // Sidebar drawer is typically a fixed panel; force-click if off-canvas animation lags.
  const item = page.locator('aside, nav, [data-sidebar], .fixed').getByText(moduleName, { exact: true }).first()
    .or(page.getByRole('button', { name: moduleName }).first())
    .or(page.getByText(moduleName, { exact: true }).first());
  await clickLoc(page, item).catch(async () => item.click({ force: true }));
  await page.waitForTimeout(900);
}

const REV_SECTION_FOR_ITEM = {
  'My Order': 'Operation',
  'Returnable Goods': 'Operation',
  'Credit Note': 'Operation',
  'Cash Purchase': 'Operation',
  'Order Template': 'Operation',
  'Production': 'Operation',
  'Central Store': 'Operation',
  'Stock Card': 'Operation',
  'Inventory': 'Operation',
  'Wastage': 'Operation',
  'Transfer': 'Operation',
  'My Component (ingredient)': 'Component',
  'Component Config': 'Component',
  'Vendor List & Products': 'Vendors',
  'Compare Price': 'Vendors',
  'Products': 'Products',
  'Product List': 'Products',
  'B2B Principal Product': 'Products',
  'Sales Order': 'Sales',
  'Active Sales': 'Sales',
  'Customer List': 'Sales',
  'Customers': 'Sales',
  'Reports': 'Reports',
  'COGS Audit': 'Reports',
};

async function openRevItem(page, itemLabel) {
  await setCaption(page, `Open ${itemLabel}`);
  const section = REV_SECTION_FOR_ITEM[itemLabel];
  if (section) {
    await page.evaluate(name => {
      const buttons = [...document.querySelectorAll('button')];
      const btn = buttons.find(b => (b.textContent || '').trim() === name);
      btn?.scrollIntoView({ block: 'center' });
      btn?.click();
    }, section);
    await page.waitForTimeout(500);
  }
  const clicked = await page.evaluate(name => {
    const buttons = [...document.querySelectorAll('button')];
    const btn = buttons.find(b => (b.textContent || '').trim() === name || (b.textContent || '').includes(name));
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    return true;
  }, itemLabel);
  if (!clicked) {
    const item = page.getByRole('button', { name: itemLabel }).first();
    await item.evaluate(el => { el.scrollIntoView({ block: 'center' }); el.click(); });
  }
  await page.waitForTimeout(1100);
}

async function focusSearchOrFirstInput(page, example) {
  const search = page.locator('input[type="search"], input[placeholder*="Search" i], input[placeholder*="Filter" i]').first();
  if (await search.count()) {
    await setCaption(page, 'Type an example search');
    await typeInto(page, search, example);
    await page.waitForTimeout(700);
    return true;
  }
  const textInput = page.locator('main input:not([type="checkbox"]):not([type="hidden"]), [data-app-main] input:not([type="checkbox"]):not([type="hidden"])').first();
  if (await textInput.count()) {
    await setCaption(page, 'Type an example value');
    await typeInto(page, textInput, example);
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

async function demoNewButton(page) {
  const btn = page.getByRole('button', { name: /^(New|Add|Create|Produce|To Produce|\+)/i }).first();
  if (await btn.count()) {
    await setCaption(page, 'Open create / add action');
    await moveTo(page, btn);
    await page.waitForTimeout(400);
    await btn.click().catch(() => {});
    await page.waitForTimeout(900);
    return true;
  }
  return false;
}

function encodeWebm(framesDir, outFile) {
  const args = [
    '-y',
    '-framerate', '12',
    '-i', path.join(framesDir, 'frame-%04d.png'),
    '-c:v', 'libvpx-vp9',
    '-b:v', '0',
    '-crf', '32',
    '-an',
    '-row-mt', '1',
    outFile,
  ];
  const r = spawnSync('ffmpeg', args, { stdio: 'pipe' });
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed for ${outFile}: ${r.stderr?.toString() || r.status}`);
  }
}

async function recordClip(browser, clipName, run) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bisync101-'));
  const videoDir = path.join(tmpRoot, 'video');
  fs.mkdirSync(videoDir);
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: videoDir, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await injectDemoChrome(page);
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(600);
    await run(page);
    await page.waitForTimeout(700);
  } finally {
    await context.close();
  }

  const videos = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
  if (!videos.length) throw new Error(`No video recorded for ${clipName}`);
  const raw = path.join(videoDir, videos[0]);
  const out = path.join(OUT_DIR, clipName);
  // Re-encode to silent VP9 for size/compatibility (Playwright WebM varies).
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-i', raw, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-an', '-vf', `scale=${W}:${H}`, out],
    { stdio: 'pipe' },
  );
  if (r.status !== 0) {
    fs.copyFileSync(raw, out);
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`  ✓ ${clipName} (${kb} KB)`);
}

async function ensureLoggedInHome(page) {
  await login(page);
  await scopeOrg(page);
  await goHome(page);
}

/** Clip scenarios: each shows real UI + cursor + typing where applicable. */
function scenarios() {
  return [
    {
      file: 'gs-sign-in.webm',
      run: async page => {
        await setCaption(page, 'Landing · open Login');
        await login(page);
        await setCaption(page, 'Home after sign-in');
        await page.waitForTimeout(1200);
      },
    },
    {
      file: 'gs-company-location.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await setCaption(page, 'STEP 1 · Choose company');
        const company = page.locator('header select').first();
        await moveTo(page, company);
        await company.selectOption({ label: COMPANY });
        await page.waitForTimeout(1000);
        await setCaption(page, 'STEP 2 · Location scope');
        const loc = page.locator('header').getByText(/All Locations|Select location|Weissbrau/i).first();
        await moveTo(page, loc);
        await page.waitForTimeout(700);
        await loc.click().catch(() => {});
        await page.waitForTimeout(800);
        await page.keyboard.press('Escape').catch(() => {});
        await setCaption(page, 'STEP 3 · Org clock follows outlet timezone');
        const clock = page.locator('header p').first();
        await moveTo(page, clock);
        await page.waitForTimeout(900);
      },
    },
    {
      file: 'gs-navigate-modules.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await setCaption(page, 'STEP 1 · Open Revenue Management tile');
        await openModuleTile(page, 'Revenue Management');
        await page.waitForTimeout(800);
        await goHome(page);
        await setCaption(page, 'STEP 2 · Open sidebar');
        await clickLoc(page, page.locator('header button').first());
        await page.waitForTimeout(500);
        await setCaption(page, 'STEP 3 · Point-of-Sales from menu');
        const pos = page.getByText('Point-of-Sales', { exact: true }).first();
        await clickLoc(page, pos).catch(async () => pos.click({ force: true }));
        await page.waitForTimeout(1000);
        await goHome(page);
      },
    },
    {
      file: 'gs-language.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await setCaption(page, 'STEP 1 · Open language flag');
        const flag = page.locator('header').getByText('🇬🇧').or(page.locator('header button').filter({ hasText: /EN|🇬🇧|language/i })).first();
        await clickLoc(page, flag);
        await page.waitForTimeout(900);
        await setCaption(page, 'STEP 2 · Pick a language');
        const opt = page.getByText(/Bahasa|中文|English|Melayu/i).first();
        if (await opt.count()) {
          await moveTo(page, opt);
          await page.waitForTimeout(700);
        }
        await page.keyboard.press('Escape').catch(() => {});
      },
    },
    {
      file: 'gs-bisync101.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await setCaption(page, 'STEP 1 · Open Bisync101');
        await clickLoc(page, page.getByRole('button', { name: /Bisync101/i }).first());
        await page.waitForTimeout(1200);
        await setCaption(page, 'STEP 2 · Pick a module');
        const mod = page.getByText('Getting Started').first();
        if (await mod.count()) await clickLoc(page, mod);
        await page.waitForTimeout(900);
        await setCaption(page, 'STEP 3 · Select a task');
        const task = page.getByText(/Sign in|Select company/i).first();
        if (await task.count()) await moveTo(page, task);
        await page.waitForTimeout(1000);
      },
    },
    {
      file: 'rms-create-po.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'My Order');
        await demoNewButton(page);
        await focusSearchOrFirstInput(page, 'Flour');
      },
    },
    {
      file: 'rms-active-purchase.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Active Purchase').catch(async () => {
          await openRevItem(page, 'My Order');
        });
        await focusSearchOrFirstInput(page, 'PO-');
      },
    },
    {
      file: 'rms-returnable-goods.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Returnable Goods');
        await focusSearchOrFirstInput(page, 'RG-');
      },
    },
    {
      file: 'rms-credit-note.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Credit Note');
        await focusSearchOrFirstInput(page, 'CN-');
      },
    },
    {
      file: 'rms-cash-purchase.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Cash Purchase');
        await demoNewButton(page);
        await focusSearchOrFirstInput(page, 'Cash buy');
      },
    },
    {
      file: 'rms-order-template.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Order Template');
        await focusSearchOrFirstInput(page, 'Weekly');
      },
    },
    {
      file: 'rms-production.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Production');
        await focusSearchOrFirstInput(page, 'Batch');
      },
    },
    {
      file: 'rms-central-store.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Central Store');
        await focusSearchOrFirstInput(page, 'SR-');
      },
    },
    {
      file: 'rms-stock-card.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Stock Card');
        await focusSearchOrFirstInput(page, 'Sugar');
      },
    },
    {
      file: 'rms-inventory-count.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Inventory');
        await demoNewButton(page);
        await focusSearchOrFirstInput(page, 'Count');
      },
    },
    {
      file: 'rms-wastage.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Wastage');
        await demoNewButton(page);
        await focusSearchOrFirstInput(page, 'Spoilage');
      },
    },
    {
      file: 'rms-transfer.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Transfer');
        await demoNewButton(page);
        await focusSearchOrFirstInput(page, 'Transfer');
      },
    },
    {
      file: 'rms-create-component.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'My Component (ingredient)');
        await demoNewButton(page);
        const name = page.locator('input').filter({ hasText: '' }).first()
          .or(page.getByPlaceholder(/name|component/i).first())
          .or(page.locator('input[type="text"]').first());
        if (await name.count()) {
          await setCaption(page, 'Type component name example');
          await typeInto(page, name, 'Demo Flour');
        } else {
          await focusSearchOrFirstInput(page, 'Flour');
        }
      },
    },
    {
      file: 'rms-component-config.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Component Config');
        await focusSearchOrFirstInput(page, 'Food');
      },
    },
    {
      file: 'rms-vendor-products.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Vendor List & Products');
        await focusSearchOrFirstInput(page, 'Vendor');
      },
    },
    {
      file: 'rms-compare-price.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Compare Price');
        await focusSearchOrFirstInput(page, 'Oil');
      },
    },
    {
      file: 'rms-products.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Products').catch(async () => openRevItem(page, 'Product List'));
        await focusSearchOrFirstInput(page, 'Burger');
      },
    },
    {
      file: 'rms-sales-order.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        // Sales Order is supply-side — use a company where the nav item is enabled.
        await selectCompany(page, 'Bisync Hospitality Sdn Bhd');
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Sales Order');
        await focusSearchOrFirstInput(page, 'SO-1042');
      },
    },
    {
      file: 'rms-customer-list.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await selectCompany(page, 'Bisync Hospitality Sdn Bhd');
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Customer List');
        await focusSearchOrFirstInput(page, 'Hotel');
      },
    },
    {
      file: 'rms-reports.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'Reports').catch(async () => openRevItem(page, 'COGS Audit'));
        await focusSearchOrFirstInput(page, 'COGS');
      },
    },
    {
      file: 'pos-menu.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Point-of-Sales');
        await openRevItem(page, 'POS Menu').catch(async () => {
          await page.getByText(/Menu/i).first().click().catch(() => {});
        });
        await focusSearchOrFirstInput(page, 'Latte');
      },
    },
    {
      file: 'pos-modifiers.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Point-of-Sales');
        await openRevItem(page, 'POS Modifier Group').catch(async () => {
          await page.getByText(/Modifier/i).first().click().catch(() => {});
        });
        await focusSearchOrFirstInput(page, 'Extra');
      },
    },
    {
      file: 'pos-promotions.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Point-of-Sales');
        await openRevItem(page, 'Promotion Scheduler').catch(async () => {
          await page.getByText(/Promotion/i).first().click().catch(() => {});
        });
        await focusSearchOrFirstInput(page, 'Happy Hour');
      },
    },
    {
      file: 'pos-config-devices.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Point-of-Sales');
        await openRevItem(page, 'POS Config').catch(async () => {
          await page.getByText(/Device|Config/i).first().click().catch(() => {});
        });
        await focusSearchOrFirstInput(page, 'Printer');
      },
    },
    {
      file: 'pos-take-order.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await setCaption(page, 'Open Point-of-Sales module');
        await openModuleTile(page, 'Point-of-Sales');
        await page.waitForTimeout(800);
        await setCaption(page, 'Open POS floor / register');
        // Prefer in-app POS entry, then standalone /POS
        const posLink = page.getByRole('button', { name: /POS Test|Open POS|Floor|Register/i }).first()
          .or(page.getByText(/POS Test|Take order|Floor plan/i).first());
        if (await posLink.count()) {
          await posLink.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1500);
        } else {
          await page.goto(`${BASE_URL}/POS`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
        }
        await setCaption(page, 'Select a table / start an order');
        const table = page.getByText(/\bT[1-9]\b|Table/i).first();
        if (await table.count()) {
          await moveTo(page, table);
          await table.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
        }
        await focusSearchOrFirstInput(page, 'Latte');
      },
    },
    {
      file: 'hr-employee-directory.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Human Resources');
        await openRevItem(page, 'Employee Directory').catch(async () => {
          await page.getByText(/Employee/i).first().click().catch(() => {});
        });
        await focusSearchOrFirstInput(page, 'Tan');
      },
    },
    {
      file: 'hr-attendance.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Human Resources');
        await openRevItem(page, 'Attendance');
        await focusSearchOrFirstInput(page, 'Clock');
      },
    },
    {
      file: 'hr-leave.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Human Resources');
        await openRevItem(page, 'Leave');
        await focusSearchOrFirstInput(page, 'Annual');
      },
    },
    {
      file: 'hr-schedule.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Human Resources');
        await openRevItem(page, 'Schedule');
        await focusSearchOrFirstInput(page, 'Shift');
      },
    },
    {
      file: 'hr-team-order.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Human Resources');
        await openRevItem(page, 'Team').catch(async () => {
          await page.getByText(/Team|Portal/i).first().click().catch(() => {});
        });
        await focusSearchOrFirstInput(page, 'Order');
      },
    },
    {
      file: 'hr-config.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Human Resources');
        await openRevItem(page, 'HR Config').catch(async () => {
          await page.getByText(/Config/i).first().click().catch(() => {});
        });
        await focusSearchOrFirstInput(page, 'Level');
      },
    },
    {
      file: 'ac-payroll.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Accounting');
        await focusSearchOrFirstInput(page, 'Payroll');
      },
    },
    {
      file: 'ac-cogs-bridge.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openModuleTile(page, 'Revenue Management');
        await openRevItem(page, 'COGS Audit').catch(async () => openRevItem(page, 'Reports'));
        await focusSearchOrFirstInput(page, 'COGS');
      },
    },
    {
      file: 'sc-create-company.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openSidebarNav(page, 'System Configuration');
        await openRevItem(page, 'Companies').catch(async () => {
          await page.getByText(/Compan/i).first().click().catch(() => {});
        });
        await demoNewButton(page);
        await focusSearchOrFirstInput(page, 'Demo Co');
      },
    },
    {
      file: 'sc-create-location.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openSidebarNav(page, 'System Configuration');
        await openRevItem(page, 'Locations');
        await demoNewButton(page);
        await focusSearchOrFirstInput(page, 'Pavilion');
      },
    },
    {
      file: 'sc-access-control.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openSidebarNav(page, 'System Configuration');
        await openRevItem(page, 'Access Control');
        await focusSearchOrFirstInput(page, 'Admin');
      },
    },
    {
      file: 'sc-audit-trail.webm',
      run: async page => {
        await ensureLoggedInHome(page);
        await openSidebarNav(page, 'System Configuration');
        await openRevItem(page, 'Audit Trail');
        await focusSearchOrFirstInput(page, 'Login');
      },
    },
  ];
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=960,540'],
  });

  const all = scenarios().filter(s => {
    if (!ONLY.size) return true;
    const id = s.file.replace(/\.webm$/i, '');
    return ONLY.has(id) || ONLY.has(s.file);
  });

  console.log(`Capturing ${all.length} Bisync101 clips from ${BASE_URL}`);
  let failed = 0;
  for (const scenario of all) {
    process.stdout.write(`→ ${scenario.file}\n`);
    try {
      await recordClip(browser, scenario.file, scenario.run);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${scenario.file}: ${err instanceof Error ? err.message : err}`);
    }
  }
  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, 'README.md'),
    [
      '# Bisync101 clips',
      '',
      'Silent WebM recordings captured from the **live Bisync.cloud UI**',
      '(cursor moves + typed examples), not synthetic Pillow mockups.',
      '',
      'Regenerate:',
      '```bash',
      'BASE_URL=http://127.0.0.1:5173 BISYNC_EMAIL=dra@cubevalue.com BISYNC_PASSWORD=\'Pass@123\' \\',
      '  node scripts/capture-bisync101-clips.mjs',
      '```',
      '',
      'Optional: `ONLY=gs-sign-in,rms-create-po` to capture a subset.',
      '',
    ].join('\n'),
  );

  if (failed) {
    console.error(`Done with ${failed} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('All clips captured.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
