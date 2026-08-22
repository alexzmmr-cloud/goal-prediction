import { withPage } from './browser.mjs';
import { readCurrentMinute, readLiveStats } from './sites/forebet-live.mjs';
import { evaluateBaseline, evaluateGrowth, isReadyForSecondHalf } from './alert-rule.mjs';

// Контрольные точки (переработано по запросу пользователя — см. Plan.md):
// 10'/15'/25'/30' — 1-й тайм, проверяются всегда. 50'/60'/75' — 2-й тайм,
// проверяются ТОЛЬКО если матч прошёл isReadyForSecondHalf на отсечке 30'
// (см. pollMatch) — иначе матч останавливается после 30' и во 2-й тайм не
// переходит вовсе (не просто "пропускает отсечки", а status='done').
export const FIRST_HALF_CHECKPOINTS = [10, 15, 25, 30];
export const SECOND_HALF_CHECKPOINTS = [50, 60, 75];
const FIRST_HALF_CHECKPOINTS_SET = new Set(FIRST_HALF_CHECKPOINTS);
const LAST_FIRST_HALF_CHECKPOINT = FIRST_HALF_CHECKPOINTS[FIRST_HALF_CHECKPOINTS.length - 1];

// Отсечки 1-го тайма валидны только пока реально идёт 1-й тайм — если
// планировщик впервые опрашивает матч уже позже (например, процесс был
// запущен с опозданием), их нельзя честно проверить и нужно пропустить,
// а не засчитать с данными случайной поздней минуты.
const FIRST_HALF_END = 45;

// Сколько подряд идущих отметок с недоступной статистикой (isError) означают
// "этот матч не покрыт data-провайдером Forebet, а не разовый сетевой
// сбой" — наблюдение пользователя: некоторые матчи (обычно второстепенные
// лиги) стабильно не отдают статистику ни на одной отметке. Держать такой
// матч в мониторинге до конца дня бессмысленно.
export const CONSECUTIVE_ERRORS_TO_EXCLUDE = 2;

// Обновляет счётчик ПОДРЯД идущих ошибок статистики и переводит watch в
// excluded_no_data при достижении порога. Успешная проверка сбрасывает
// счётчик — разовый сетевой сбой не должен исключить матч, который на деле
// просто временно не ответил. Вынесена отдельно (не инлайн в pollMatch),
// чтобы test-no-data.mjs мог проверять именно эту логику напрямую, а не
// копию — иначе изменение здесь могло бы разойтись с тестом незаметно.
export function applyErrorTracking(watch, isError) {
  watch.consecutiveErrors = isError ? watch.consecutiveErrors + 1 : 0;
  if (watch.consecutiveErrors >= CONSECUTIVE_ERRORS_TO_EXCLUDE) {
    watch.status = 'excluded_no_data';
  }
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
    consecutiveErrors: 0, // подряд идущие isError-отметки (см. CONSECUTIVE_ERRORS_TO_EXCLUDE)
    lastShots: null, // { home, away } с последней успешно проверенной отсечки — база для evaluateGrowth
    playSecondHalf: false, // выставляется на 30' через isReadyForSecondHalf — определяет, войдут ли в очередь отметки 50/60/75
    status: 'watching', // watching | done | out_of_range | excluded_no_data
  };
}

function activeCheckpoints(watch) {
  return watch.playSecondHalf ? [...FIRST_HALF_CHECKPOINTS, ...SECOND_HALF_CHECKPOINTS] : FIRST_HALF_CHECKPOINTS;
}

function nextCheckpoint(watch) {
  return activeCheckpoints(watch).find(
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

    if (FIRST_HALF_CHECKPOINTS_SET.has(cp) && minute > FIRST_HALF_END) {
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
    // skippedCheckpoints выше (там причина архитектурная — тайминг, здесь —
    // сбой источника данных на конкретном опросе).
    watch.checkedCheckpoints.push(cp);

    // Первая отсечка (10') — абсолютный порог, нет предыдущей точки для
    // сравнения. Все остальные — прирост относительно watch.lastShots.
    const verdict = watch.lastShots === null ? evaluateBaseline(stats) : evaluateGrowth(stats, watch.lastShots);

    // Счёт перестал быть 0:0 — мониторинг матча прекращается окончательно,
    // без возврата, даже если счёт позже перестанет расти (см. Plan.md:
    // пользователь явно попросил убрать отдельную ветку 2-го тайма с
    // "низкими" счетами — теперь единственный допустимый счёт всегда 0:0,
    // единица мониторинга всегда матч целиком).
    if (verdict.reason === 'score_not_low') {
      watch.status = 'out_of_range';
    } else if (stats.status === 'ok') {
      // Запоминаем удары ТОЛЬКО при успешном чтении статистики — сбой
      // источника не должен обнулять базу сравнения для следующей отсечки.
      watch.lastShots = { home: stats.home?.shotsOnGoal ?? 0, away: stats.away?.shotsOnGoal ?? 0 };
    }

    // На последней отсечке 1-го тайма (30') отдельно решаем, продолжать ли
    // во 2-й тайм — критерий (удары к концу тайма выше порога) не совпадает
    // с verdict.alert выше (там это прирост, здесь — абсолютное значение).
    if (cp === LAST_FIRST_HALF_CHECKPOINT && watch.status === 'watching') {
      watch.playSecondHalf = isReadyForSecondHalf(stats);
    }

    const isError = stats.status !== 'ok';
    applyErrorTracking(watch, isError);

    const result = {
      checkpoint: cp,
      minute,
      stats,
      isError,
      verdict,
    };
    if (onCheckpoint) onCheckpoint(watch, result);
    return result;
  }, { timeout: 45000 });
}
