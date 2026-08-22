import 'dotenv/config';
import { withStealthPage, withVisiblePage } from './browser-stealth.mjs';
import { url as forebetTodayUrl, scrapeToday } from './sites/forebet-today.mjs';
import { createMatchWatch, pollMatch, CONSECUTIVE_ERRORS_TO_EXCLUDE } from './scheduler.mjs';
import { appendAlert } from './alert-log.mjs';
import { createBot, sendAlert, sendStatus } from './telegram.mjs';
import { mayHaveStarted } from './sites/forebet-kickoff.mjs';

const POLL_INTERVAL_MS = 60_000; // см. Plan.md, шаг 3: разумный интервал 1-2 минуты

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
  console.log(`Матчей всего: ${all.length}`);

  await sendStatus(bot, chatId, `▶️ Мониторинг запущен: ${all.length} матчей.`);

  const watches = all.map(createMatchWatch);

  while (watches.some((w) => w.status === 'watching')) {
    for (const watch of watches) {
      if (watch.status !== 'watching') continue;

      // Не открываем браузер для матчей, время кик-оффа которых ещё
      // заведомо не подошло (см. sites/forebet-kickoff.mjs) — иначе при
      // запуске утром на весь день скрипт впустую дёргал бы вечерние
      // матчи каждую минуту по много часов подряд.
      if (!mayHaveStarted(watch.kickoffText)) continue;

      const result = await pollMatch(watch, {
        onCheckpoint: async (w, r) => {
          console.log(`[${w.homeTeam} - ${w.awayTeam}] отметка ${r.checkpoint}', минута ${r.minute}, verdict=${r.verdict.reason}`);
          // Отсечка 10' — только тихая база для сравнения на 15' (см.
          // scheduler.mjs, watch.lastShots), в Telegram не шлётся: почти
          // любая команда делает хотя бы 1 удар к 10-й минуте, реального
          // сигнала в этом ещё нет (по решению пользователя после того как
          // Telegram завалило сообщениями на этой отсечке).
          if (r.verdict.alert && r.checkpoint !== 10) {
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

      if (watch.status === 'excluded_no_data') {
        console.log(`[${watch.homeTeam} - ${watch.awayTeam}] исключён: ${CONSECUTIVE_ERRORS_TO_EXCLUDE} отметки подряд без статистики (матч не покрыт data-провайдером Forebet)`);
      }

      void result;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.log('Все матчи из списка отслежены (все контрольные точки пройдены).');
  await sendStatus(bot, chatId, '✅ Мониторинг завершён: все матчи дня отслежены.');
}

main().catch(async (err) => {
  console.error(err);
  // Пользователь не смотрит в терминал (закрытая крышка, внешний монитор) —
  // тишина в Telegram не должна означать "всё ещё работает", если процесс
  // на самом деле упал. Best-effort: если бот/chatId сами недоступны
  // (например упали ещё до createBot), это сообщение тоже не дойдёт —
  // тогда остаётся только консоль, это неизбежная граница.
  try {
    const bot = createBot();
    await sendStatus(bot, process.env.TELEGRAM_CHAT_ID, `🛑 Мониторинг аварийно остановлен: ${err.message}`);
  } catch {
    // не смогли даже уведомить — см. комментарий выше
  }
  process.exit(1);
});
