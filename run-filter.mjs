import { withStealthPage, withVisiblePage } from './browser-stealth.mjs';
import { url, scrapeToday, filterByTotal } from './sites/forebet-today.mjs';

const minTotal = Number(process.argv[2] || 3);

// Forebet стоит за Cloudflare managed challenge — нестабильно отдаёт полный
// список от попытки к попытке (см. тот же приём в FOOTBALL-TIPS/scrape.mjs).
// Берём несколько тихих попыток и оставляем лучший (максимальный) результат,
// при полном провале — fallback на видимое окно.
async function scrapeWithRetries(maxAttempts = 3) {
  let best = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      console.log(`[RETRY] попытка ${attempt}/${maxAttempts} (лучший результат пока ${best.length} матчей)`);
      await new Promise((r) => setTimeout(r, 3000));
    }
    try {
      const raw = await withStealthPage(url, (page) => scrapeToday(page), { timeout: 45000 });
      if (raw.length > best.length) best = raw;
    } catch (err) {
      console.log(`[FAIL attempt ${attempt}] ${err.message}`);
    }
  }
  if (best.length === 0) {
    console.log('[MANUAL] тихие попытки не прошли антибот-защиту, пробую с видимым окном');
    try {
      best = await withVisiblePage(url, (page) => scrapeToday(page), { timeout: 60000 });
    } catch (err) {
      console.log(`[FAIL manual] ${err.message}`);
    }
  }
  return best;
}

const all = await scrapeWithRetries();
const filtered = filterByTotal(all, minTotal);

console.log(`Всего матчей на странице: ${all.length}`);
console.log(`С прогнозным тоталом >= ${minTotal}: ${filtered.length}`);
console.log('---');
for (const m of filtered) {
  console.log(`${m.homeTeam} - ${m.awayTeam} | прогноз ${m.predictedScore} (тотал ${m.predictedTotal}) | id=${m.matchId} | ${m.kickoffISO}`);
}
