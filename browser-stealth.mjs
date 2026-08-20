import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import os from 'node:os';

chromium.use(StealthPlugin());

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// См. browser.mjs — та же причина и тот же CHROMIUM_PATH override для переносимости.
const LOCAL_CHROMIUM_PATH = process.env.CHROMIUM_PATH
  || `${os.homedir()}/Library/Caches/ms-playwright/chromium-1187/chrome-mac/Chromium.app/Contents/MacOS/Chromium`;

export async function withStealthPage(url, fn, { timeout = 30000 } = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: LOCAL_CHROMIUM_PATH });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1400, height: 2000 } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(2000);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

// Fallback: Cloudflare managed challenge иногда детектит сам headless-режим
// (не капча для человека) — в видимом окне обычно проходит сама за
// несколько секунд без клика (см. тот же приём в FOOTBALL-TIPS/browser-stealth.mjs,
// многократно проверено там вручную).
export async function withVisiblePage(url, fn, { timeout = 60000, autoWaitMs = 8000 } = {}) {
  const browser = await chromium.launch({ headless: false, executablePath: LOCAL_CHROMIUM_PATH });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(autoWaitMs);
    return await fn(page);
  } finally {
    await browser.close();
  }
}
