// Парсинг ориентировочного времени кик-оффа из текста Forebet ("DD/MM/YYYY HH:mm").
// Это НЕ источник истины о ходе матча (им остаётся игровая минута со страницы
// самого матча, см. Plan.md, 1.3) — только грубый фильтр, чтобы не открывать
// браузер и не опрашивать матч, который заведомо ещё не мог начаться.
//
// Часовой пояс отображения на сайте настраиваемый (см. вопрос пользователя про
// timezone) и неизвестен нам точно — поэтому берём щедрый запас на
// неточность (KICKOFF_LEAD_MINUTES), а не считаем время секунда-в-секунду.

export const KICKOFF_LEAD_MINUTES = 180; // 3 часа запаса на расхождение часовых поясов/данных

export function parseKickoffText(kickoffText) {
  if (!kickoffText) return null;
  const m = kickoffText.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, dayStr, monthStr, yearStr, hourStr, minuteStr] = m;
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  // Отсекаем семантически некорректные значения (месяц 13, день 32 и т.п.) —
  // Date их молча "перекатывает" в соседний месяц/день вместо ошибки, что
  // ломало бы заявленное fail-open поведение mayHaveStarted() ниже.
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  // new Date(...) в локальном часовом поясе процесса — умышленно приблизительно,
  // см. комментарий выше про KICKOFF_LEAD_MINUTES. Диапазонная проверка day<=31
  // не учитывает длину конкретного месяца (31 апреля и т.п.) — намеренное
  // упрощение: источник (Forebet) отдаёт только сегодняшние матчи, реальные
  // невозможные даты вроде "31/04" здесь не встречаются.
  const date = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// true, если матч мог уже начаться (с учётом запаса) или время кик-оффа
// не удалось разобрать (тогда не блокируем — лучше лишний опрос, чем
// пропустить реально идущий матч из-за ошибки парсинга).
export function mayHaveStarted(kickoffText, now = new Date()) {
  const kickoff = parseKickoffText(kickoffText);
  if (!kickoff) return true;
  const threshold = new Date(kickoff.getTime() - KICKOFF_LEAD_MINUTES * 60_000);
  return now >= threshold;
}
