// Правило алерта (см. Plan.md, 1.3 "Допущения" и 2.1 "Ключевое правило"):
// - счёт на момент отсечки входит в список "низких";
// - суммарные (с начала матча) удары в створ у ЛЮБОЙ команды > SHOTS_ON_GOAL_THRESHOLD.
// Оба условия обязательны одновременно (порог сам по себе, без низкого счёта,
// не даёт алерт — низкий счёт зафиксирован планом как обязательное условие входа).

export const SHOTS_ON_GOAL_THRESHOLD = 2;

// Счета вида "0-0", "0-1", "1-1", "1-0" — ровно фиксированный список из Plan.md 1.3,
// не общее правило "разница <= 1", чтобы не расширять условие сверх того, что описано.
const LOW_SCORES = new Set(['0-0', '0-1', '1-1', '1-0']);

export function isLowScore(score) {
  if (!score) return false;
  return LOW_SCORES.has(score.replace(/\s+/g, ''));
}

// stats — результат readLiveStats() из sites/forebet-live.mjs (status: 'ok' | 'no_data' | ...).
export function evaluateAlert(stats) {
  if (!stats || stats.status !== 'ok') {
    return { alert: false, reason: `stats_${stats?.status || 'missing'}` };
  }

  if (!isLowScore(stats.score)) {
    return { alert: false, reason: 'score_not_low', score: stats.score };
  }

  const homeShots = stats.home?.shotsOnGoal ?? 0;
  const awayShots = stats.away?.shotsOnGoal ?? 0;
  const triggered = homeShots > SHOTS_ON_GOAL_THRESHOLD || awayShots > SHOTS_ON_GOAL_THRESHOLD;

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
