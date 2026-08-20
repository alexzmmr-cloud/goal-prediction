// Live-статистика конкретного матча Forebet.
// См. Plan.md, шаг 1: клик по live-счёту открывает модалку "Статистика",
// которая вызывает GET /scripts/get_evs_n.php?gdt=1&mid=<id>&gmc=1.
// Прямой HTTP-запрос к этому эндпоинту без браузера получает 403
// (Cloudflare managed challenge) — поэтому дёргаем его изнутри уже
// открытой Playwright-страницы через перехват сетевого ответа,
// а не через DOM-парсинг модалки.

export function matchPageUrl(matchUrlOrId) {
  return typeof matchUrlOrId === 'string' && matchUrlOrId.startsWith('http')
    ? matchUrlOrId
    : null;
}

// Читает текущую минуту матча прямо со страницы (без обращения к API статистики).
export async function readCurrentMinute(page) {
  return await page.evaluate(() => {
    const el = document.querySelector('.l_min');
    if (!el) return null;
    const m = el.textContent.trim().match(/^(\d+)/);
    return m ? Number(m[1]) : null;
  });
}

// Открывает модалку статистики (клик по live-счёту -> вкладка "Статистика")
// и перехватывает ответ get_evs_n.php?...&gmc=1. Возвращает распарсенный JSON
// или null, если провайдер ещё не прислал данные по этому матчу.
export async function readLiveStats(page, matchId) {
  const responsePromise = page
    .waitForResponse(
      (res) => res.url().includes('get_evs_n.php') && res.url().includes('gmc=1'),
      { timeout: 10000 },
    )
    .catch(() => null);

  const scoreEl = page.locator('span.lscrlv').first();
  if ((await scoreEl.count()) === 0) {
    return { status: 'no_live_score_element' };
  }
  await scoreEl.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Название вкладки зависит от языка страницы (ru: "Статистика", en: "Stats"
  // и т.п.) — вместо текста берём последнюю из трёх вкладок модалки по позиции
  // (События/Составы/Статистика — Статистика всегда третья и последняя кнопка
  // в .tabs-ul).
  const tabs = page.locator('.ft-events .tabs-ul button');
  if ((await tabs.count()) > 0) {
    await tabs.last().click({ timeout: 5000 }).catch(() => {});
  }

  const res = await responsePromise;
  if (!res) return { status: 'no_stats_response' };

  let json;
  try {
    json = JSON.parse(await res.text());
  } catch {
    return { status: 'invalid_json' };
  }

  if (!json.stats || json.stats.length < 2) {
    return { status: 'no_data', raw: json };
  }

  const [teamA, teamB] = json.stats;
  return {
    status: 'ok',
    score: json.scores?.ft_score || null,
    htScore: json.scores?.ht_score || null,
    home: {
      teamId: teamA.team_id,
      shotsOnGoal: teamA.shots?.ongoal ?? null,
      shotsTotal: teamA.shots?.total ?? null,
      dangerousAttacks: teamA.attacks?.dangerous_attacks ?? null,
    },
    away: {
      teamId: teamB.team_id,
      shotsOnGoal: teamB.shots?.ongoal ?? null,
      shotsTotal: teamB.shots?.total ?? null,
      dangerousAttacks: teamB.attacks?.dangerous_attacks ?? null,
    },
  };
}
