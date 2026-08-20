import { withPage } from './browser.mjs';
import { readCurrentMinute, readLiveStats } from './sites/forebet-live.mjs';
import { evaluateAlert } from './alert-rule.mjs';

// Контрольные точки: 15'/25' — 1-й тайм (только при счёте 0:0, см. Plan.md, 1.1/1.3
// и уточнение порогов в alert-rule.mjs), 50/60/70/80' — 2-й тайм.
export const CHECKPOINTS = [15, 25, 50, 60, 70, 80];
const FIRST_HALF_CHECKPOINTS = new Set([15, 25]);

// Отсечки 1-го тайма валидны только пока реально идёт 1-й тайм — если
// планировщик впервые опрашивает матч уже позже (например, процесс был
// запущен с опозданием), их нельзя честно проверить и нужно пропустить,
// а не засчитать с данными случайной поздней минуты.
const FIRST_HALF_END = 45;

function halfFor(checkpoint) {
  return FIRST_HALF_CHECKPOINTS.has(checkpoint) ? 1 : 2;
}

// Состояние одного отслеживаемого матча.
export function createMatchWatch(match) {
  return {
    matchUrl: match.matchUrl,
    matchId: match.matchId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoffText: match.kickoffText, // ориентир для mayHaveStarted() — не трогать матч раньше времени (см. sites/forebet-kickoff.mjs)
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

    if (FIRST_HALF_CHECKPOINTS.has(cp) && minute > FIRST_HALF_END) {
      // 1-й тайм уже точно закончился — эту отметку нельзя честно проверить.
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

    const half = halfFor(cp);
    const verdict = evaluateAlert(stats, half);

    // Счёт вышел за пределы списка "низких" — мониторинг матча прекращается
    // окончательно, без возврата, даже если счёт позже снова попадёт в
    // диапазон (см. Plan.md, 1.3: "например 1-0 → 2-0 → 2-1"). Срабатывает
    // только на реальном известном счёте (verdict.reason === 'score_not_low'),
    // не на сбоях чтения статистики (isError обрабатывается отдельно, матч
    // остаётся watching, чтобы дать шанс следующей отметке). Только для
    // отсечек 2-го тайма: список "низких" для 1-го тайма — строго {0-0}, и
    // гол на 15'/25' (счёт 1-0/0-1) не должен блокировать матч — план прямо
    // требует, чтобы отсечки 2-го тайма всё равно проверялись по своему
    // (более широкому) списку счетов независимо от истории 1-го тайма.
    if (half === 2 && verdict.reason === 'score_not_low') {
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
