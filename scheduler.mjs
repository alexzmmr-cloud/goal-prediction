import { withPage } from './browser.mjs';
import { readCurrentMinute, readLiveStats } from './sites/forebet-live.mjs';
import { evaluateAlert } from './alert-rule.mjs';

// Контрольные точки: 15' только для 1-го тайма (см. Plan.md, 1.1/1.3),
// остальные — 2-й тайм.
export const CHECKPOINTS = [15, 50, 60, 70, 80];

// 15' валидна только пока реально идёт 1-й тайм (см. Plan.md, 1.1/1.3) —
// если планировщик впервые опрашивает матч уже позже (например, процесс был
// запущен с опозданием), 15' нельзя честно проверить и её нужно пропустить,
// а не засчитать с данными случайной поздней минуты.
const FIRST_HALF_END = 45;

// Состояние одного отслеживаемого матча.
export function createMatchWatch(match) {
  return {
    matchUrl: match.matchUrl,
    matchId: match.matchId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    checkedCheckpoints: [], // пройденные отметки (число минут)
    skippedCheckpoints: [], // отметки, которые нельзя было честно проверить (см. FIRST_HALF_END)
    status: 'watching', // watching | done | out_of_range
  };
}

function nextCheckpoint(watch) {
  return CHECKPOINTS.find(
    (cp) => !watch.checkedCheckpoints.includes(cp) && !watch.skippedCheckpoints.includes(cp),
  );
}

// Один опрос матча: читает текущую минуту, и если она достигла (или прошла)
// ближайшую непройденную отметку — читает статистику и возвращает результат
// проверки контрольной точки. Иначе возвращает null (рано, ждём дальше).
export async function pollMatch(watch, { onCheckpoint, onSkip } = {}) {
  if (watch.status !== 'watching') return null;

  const cp = nextCheckpoint(watch);
  if (cp === undefined) {
    watch.status = 'done';
    return null;
  }

  return await withPage(watch.matchUrl, async (page) => {
    const minute = await readCurrentMinute(page);
    if (minute === null) return null;
    if (minute < cp) return null; // отметка ещё не наступила

    if (cp === 15 && minute > FIRST_HALF_END) {
      // 1-й тайм уже точно закончился — 15' нельзя честно проверить.
      watch.skippedCheckpoints.push(cp);
      if (onSkip) onSkip(watch, { checkpoint: cp, minute });
      return null;
    }

    // Минута достигла (или уже прошла) ближайшую непройденную отметку —
    // выполняем полную проверку статистики на этой отметке. Расчётное время
    // "кик-офф + N минут" намеренно не используется (см. Plan.md, 1.3) —
    // ориентир только игровая минута с самой страницы.
    const stats = await readLiveStats(page, watch.matchId);
    // Отметка считается пройденной независимо от успеха чтения статистики
    // (см. Plan.md, шаг 4: недоступность Forebet на отсечке не должна
    // прерывать мониторинг следующих отсечек) — это отдельный смысл от
    // skippedCheckpoints выше (там причина архитектурная — тайминг 15',
    // здесь — сбой источника данных на конкретном опросе).
    watch.checkedCheckpoints.push(cp);

    const verdict = evaluateAlert(stats);

    // Счёт вышел за пределы списка "низких" — мониторинг матча прекращается
    // окончательно, без возврата, даже если счёт позже снова попадёт в
    // диапазон (см. Plan.md, 1.3: "например 1-0 → 2-0 → 2-1"). Срабатывает
    // только на реальном известном счёте (verdict.reason === 'score_not_low'),
    // не на сбоях чтения статистики (isError обрабатывается отдельно, матч
    // остаётся watching, чтобы дать шанс следующей отметке).
    if (verdict.reason === 'score_not_low') {
      watch.status = 'out_of_range';
    }

    const result = {
      checkpoint: cp,
      minute,
      stats,
      isError: stats.status !== 'ok',
      verdict,
    };
    if (onCheckpoint) onCheckpoint(watch, result);
    return result;
  }, { timeout: 45000 });
}
