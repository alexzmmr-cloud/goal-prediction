// Правило алерта (см. Plan.md, 1.3 "Допущения" и 2.1 "Ключевое правило"):
// - счёт на момент отсечки входит в список "низких" для этой половины матча;
// - суммарные (с начала матча) удары в створ у ЛЮБОЙ команды > порога для этой половины.
// Оба условия обязательны одновременно (порог сам по себе, без низкого счёта,
// не даёт алерт — низкий счёт зафиксирован планом как обязательное условие входа).
//
// Порог и список "низких" счетов разные для 1-го и 2-го тайма (уточнено
// пользователем после наблюдения за реальными матчами): в 1-м тайме порог
// ниже, но счёт обязан быть строго 0:0 (более мягкое требование к ударам
// компенсируется более строгим требованием к счёту); во 2-м тайме порог
// выше — иначе за 50-80 минут игры 2+ удара в створ у команды не редкость
// и не показатель скорого гола, а просто шум.

export const FIRST_HALF_SHOTS_THRESHOLD = 2;
export const SECOND_HALF_SHOTS_THRESHOLD = 4;

const FIRST_HALF_LOW_SCORES = new Set(['0-0']);
const SECOND_HALF_LOW_SCORES = new Set(['0-0', '0-1', '1-1', '1-0']);

function lowScoresFor(half) {
  return half === 1 ? FIRST_HALF_LOW_SCORES : SECOND_HALF_LOW_SCORES;
}

function thresholdFor(half) {
  return half === 1 ? FIRST_HALF_SHOTS_THRESHOLD : SECOND_HALF_SHOTS_THRESHOLD;
}

export function isLowScore(score, half = 2) {
  if (!score) return false;
  return lowScoresFor(half).has(score.replace(/\s+/g, ''));
}

// stats — результат readLiveStats() из sites/forebet-live.mjs (status: 'ok' | 'no_data' | ...).
// half — 1 (отсечки 15'/25') или 2 (отсечки 50'/60'/70'/80'), определяет
// порог по ударам и допустимый список счетов (см. комментарий выше).
export function evaluateAlert(stats, half = 2) {
  if (!stats || stats.status !== 'ok') {
    return { alert: false, reason: `stats_${stats?.status || 'missing'}` };
  }

  if (!isLowScore(stats.score, half)) {
    return { alert: false, reason: 'score_not_low', score: stats.score };
  }

  const threshold = thresholdFor(half);
  const homeShots = stats.home?.shotsOnGoal ?? 0;
  const awayShots = stats.away?.shotsOnGoal ?? 0;
  const triggered = homeShots > threshold || awayShots > threshold;

  if (!triggered) {
    return { alert: false, reason: 'shots_below_threshold', homeShots, awayShots };
  }

  return {
    alert: true,
    reason: 'triggered',
    score: stats.score,
    homeShots,
    awayShots,
  };
}
