import 'dotenv/config';
import { withStealthPage, withVisiblePage } from './browser-stealth.mjs';
import { url as forebetTodayUrl, scrapeToday, filterByTotal } from './sites/forebet-today.mjs';
import { createMatchWatch, pollMatch } from './scheduler.mjs';
import { appendAlert } from './alert-log.mjs';
import { createBot, sendAlert } from './telegram.mjs';

const POLL_INTERVAL_MS = 60_000; // см. Plan.md, шаг 3: разумный интервал 1-2 минуты
const MIN_TOTAL = 3;

async function scrapeTodayWithRetries(maxAttempts = 3) {
  let best = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 3000));
    try {
      const raw = await withStealthPage(forebetTodayUrl, (page) => scrapeToday(page), { timeout: 45000 });
      if (raw.length > best.length) best = raw;
    } catch (err) {
      console.log(`[FAIL attempt ${attempt}] ${err.message}`);
    }
  }
  if (best.length === 0) {
    best = await withVisiblePage(forebetTodayUrl, (page) => scrapeToday(page), { timeout: 60000 }).catch(() => []);
  }
  return best;
}

async function main() {
  const bot = createBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log('Получаю дневной список матчей Forebet...');
  const all = await scrapeTodayWithRetries();
  const filtered = filterByTotal(all, MIN_TOTAL);
  console.log(`Матчей всего: ${all.length}, с тоталом >= ${MIN_TOTAL}: ${filtered.length}`);

  const watches = filtered.map(createMatchWatch);

  while (watches.some((w) => w.status === 'watching')) {
    for (const watch of watches) {
      if (watch.status !== 'watching') continue;

      const result = await pollMatch(watch, {
        onCheckpoint: async (w, r) => {
          console.log(`[${w.homeTeam} - ${w.awayTeam}] отметка ${r.checkpoint}', минута ${r.minute}, verdict=${r.verdict.reason}`);
          if (r.verdict.alert) {
            const alertData = {
              matchId: w.matchId,
              homeTeam: w.homeTeam,
              awayTeam: w.awayTeam,
              checkpoint: r.checkpoint,
              minute: r.minute,
              score: r.verdict.score,
              homeShots: r.verdict.homeShots,
              awayShots: r.verdict.awayShots,
            };
            await appendAlert(alertData);
            await sendAlert(bot, chatId, alertData);
            console.log(`  -> ALERT отправлен в Telegram`);
          }
        },
        onSkip: (w, r) => console.log(`[${w.homeTeam} - ${w.awayTeam}] отметка ${r.checkpoint}' пропущена (минута ${r.minute})`),
      }).catch((err) => {
        console.log(`[FAIL] ${watch.homeTeam} - ${watch.awayTeam}: ${err.message}`);
      });

      void result;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.log('Все матчи из списка отслежены (все контрольные точки пройдены).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
