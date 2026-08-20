// Дневной список прогнозов Forebet + фильтр по прогнозному тоталу.
export const url = 'https://www.forebet.com/en/football-tips-and-predictions-for-today';

export async function scrapeToday(page) {
  // Список ограничен по умолчанию; кнопка "More" дозагружает остальные через JS
  // (тот же приём, что в FOOTBALL-TIPS/sites/forebet.mjs).
  for (let i = 0; i < 30; i++) {
    const more = page.locator('span[onclick^="ltodrows"]:visible');
    if ((await more.count()) === 0) break;
    try {
      await more.first().click({ timeout: 2000 });
      await page.waitForTimeout(800);
    } catch {
      break;
    }
  }

  return await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll('.rcnt');
    rows.forEach((row) => {
      const home = row.querySelector('.homeTeam [itemprop="name"]')?.textContent?.trim();
      const away = row.querySelector('.awayTeam [itemprop="name"]')?.textContent?.trim();
      const dateAttr = row.querySelector('time[itemprop="startDate"]')?.getAttribute('datetime');
      // datetime-атрибут даёт только дату (YYYY-MM-DD); видимый текст .date_bah
      // содержит дату+время вида "20/08/2026 12:00" — это ориентир для
      // планировщика (не дёргать матч раньше времени), не источник истины
      // о ходе матча (им остаётся игровая минута со страницы самого матча,
      // см. Plan.md, 1.3).
      const kickoffText = row.querySelector('.date_bah')?.textContent?.trim() || null;
      const exactScore = row.querySelector('.ex_sc:not(.tabonly)')?.textContent?.trim()
        || row.querySelector('.scrmobpred')?.textContent?.replace(/\s+/g, '');
      const link = row.querySelector('a.tnmscn')?.href
        || row.querySelector('.tnms a')?.href
        || row.querySelector('a[href*="/football/matches/"]')?.href;
      if (!home || !away || !link) return;

      results.push({
        homeTeam: home,
        awayTeam: away,
        kickoffISO: dateAttr || null,
        kickoffText,
        predictedScore: exactScore || null,
        matchUrl: link,
        matchId: extractMatchId(link),
      });
    });
    return results;

    function extractMatchId(href) {
      const m = href.match(/-(\d+)(?:[/?#]|$)/);
      return m ? m[1] : null;
    }
  });
}

// Прогнозный счёт вида "2-1", "3-0" и т.п. -> сумма голов.
export function predictedTotal(predictedScore) {
  if (!predictedScore) return null;
  const m = predictedScore.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]);
}

// Фильтр по правилу проекта: берём матчи с прогнозным тоталом >= minTotal (по умолчанию 3).
export function filterByTotal(matches, minTotal = 3) {
  return matches
    .map((m) => ({ ...m, predictedTotal: predictedTotal(m.predictedScore) }))
    .filter((m) => m.predictedTotal !== null && m.predictedTotal >= minTotal);
}
