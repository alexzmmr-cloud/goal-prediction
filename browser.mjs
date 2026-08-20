import { chromium } from 'playwright';
import os from 'node:os';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// На этой машине (macOS 13) свежие ревизии Chromium из playwright-core не запускаются
// ("Playwright does not support chromium on mac13"). Используем более старую ревизию,
// уже установленную в кэше playwright для соседнего проекта FOOTBALL-TIPS.
// На сервере/другой машине эта версия и путь могут отличаться или отсутствовать —
// переопределяется через CHROMIUM_PATH; при её отсутствии используется путь по
// умолчанию, а если и его нет на диске, launch ошибётся штатно (без CHROMIUM_PATH
// на другой машине эту переменную нужно выставить в .env).
const LOCAL_CHROMIUM_PATH = process.env.CHROMIUM_PATH
  || `${os.homedir()}/Library/Caches/ms-playwright/chromium-1187/chrome-mac/Chromium.app/Contents/MacOS/Chromium`;

export async function withPage(url, fn, { timeout = 30000 } = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: LOCAL_CHROMIUM_PATH });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1400, height: 2000 } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(2000);
    await dismissCookieBanner(page);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function dismissCookieBanner(page) {
  const selectors = [
    'button:has-text("Consent")',
    'button:has-text("Accept")',
    'button:has-text("I Agree")',
    'button:has-text("AGREE")',
    '.fc-cta-consent',
    '.fc-button.fc-cta-consent',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // баннера с этим селектором нет — пробуем следующий
    }
  }
}
