// Правило алерта (переработано по запросу пользователя — см. Plan.md,
// раздел про отказ от 2-го тайма с "низкими" счетами и переход на модель
// "нарастания ударов"):
// - счёт на момент отсечки должен быть строго 0:0 — как только гол забит,
//   матч навсегда выпадает из мониторинга (см. scheduler.mjs);
// - на первой отсечке (10') алерт даёт абсолютный порог FIRST_CHECKPOINT_SHOTS_THRESHOLD;
// - на каждой следующей отсечке 1-го тайма (15/25/30) и всех отсечках 2-го
//   тайма (50/60/75) алерт даёт ПРИРОСТ ударов в створ у любой команды
//   относительно последней реально проверенной отсечки (не обязательно
//   предыдущей по списку — если та была пропущена, база берётся с последней
//   успешно проверенной), а не абсолютное число — плоский матч без развития
//   не должен алертить повторно на одном и том же старом числе ударов;
// - переход из 1-го тайма во 2-й отдельно завязан на удары к концу 1-го
//   тайма (см. isReadyForSecondHalf) — обоснование порога см. README.md,
//   справочная статистика (2.5-3.3 удара в створ на гол в среднем).

export const FIRST_CHECKPOINT_SHOTS_THRESHOLD = 1;
export const GROWTH_SHOTS_THRESHOLD = 1;
export const SECOND_HALF_ENTRY_SHOTS_THRESHOLD = 3;

function isScoreless(score) {
  if (!score) return false;
  return score.replace(/\s+/g, '') === '0-0';
}

// Базовая проверка на первой отсечке (10') — нет предыдущей точки для
// сравнения, поэтому единственный критерий — абсолютный порог.
export function evaluateBaseline(stats) {
  if (!stats || stats.status !== 'ok') {
    return { alert: false, reason: `stats_${stats?.status || 'missing'}` };
  }

  if (!isScoreless(stats.score)) {
    return { alert: false, reason: 'score_not_low', score: stats.score };
  }

  const homeShots = stats.home?.shotsOnGoal ?? 0;
  const awayShots = stats.away?.shotsOnGoal ?? 0;
  const triggered = homeShots >= FIRST_CHECKPOINT_SHOTS_THRESHOLD || awayShots >= FIRST_CHECKPOINT_SHOTS_THRESHOLD;

  if (!triggered) {
    return { alert: false, reason: 'shots_below_threshold', homeShots, awayShots };
  }

  return { alert: true, reason: 'triggered', score: stats.score, homeShots, awayShots };
}

// Все отсечки после первой — алерт даёт прирост ударов у любой команды
// относительно последней проверенной отсечки (lastShots), не абсолютное
// число. lastShots — { home, away } с той отсечки, где в последний раз
// реально была прочитана статистика (см. scheduler.mjs, watch.lastShots).
export function evaluateGrowth(stats, lastShots) {
  if (!stats || stats.status !== 'ok') {
    return { alert: false, reason: `stats_${stats?.status || 'missing'}` };
  }

  if (!isScoreless(stats.score)) {
    return { alert: false, reason: 'score_not_low', score: stats.score };
  }

  const homeShots = stats.home?.shotsOnGoal ?? 0;
  const awayShots = stats.away?.shotsOnGoal ?? 0;
  const prevHome = lastShots?.home ?? 0;
  const prevAway = lastShots?.away ?? 0;
  const triggered =
    homeShots - prevHome >= GROWTH_SHOTS_THRESHOLD || awayShots - prevAway >= GROWTH_SHOTS_THRESHOLD;

  if (!triggered) {
    return { alert: false, reason: 'no_growth', homeShots, awayShots, prevHome, prevAway };
  }

  return { alert: true, reason: 'triggered', score: stats.score, homeShots, awayShots };
}

// Условие продолжения мониторинга во 2-м тайме, проверяется на последней
// отсечке 1-го тайма (30'): счёт всё ещё 0:0 и удары у любой команды выше
// SECOND_HALF_ENTRY_SHOTS_THRESHOLD — абсолютный порог, не прирост (см.
// README.md — статистически команда уже близка к среднему числу ударов на
// гол, независимо от того, была пауза перед этим или нет).
export function isReadyForSecondHalf(stats) {
  if (!stats || stats.status !== 'ok') return false;
  if (!isScoreless(stats.score)) return false;
  const homeShots = stats.home?.shotsOnGoal ?? 0;
  const awayShots = stats.away?.shotsOnGoal ?? 0;
  return homeShots > SECOND_HALF_ENTRY_SHOTS_THRESHOLD || awayShots > SECOND_HALF_ENTRY_SHOTS_THRESHOLD;
}
