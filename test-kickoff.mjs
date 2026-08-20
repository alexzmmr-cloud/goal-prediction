import { parseKickoffText, mayHaveStarted, KICKOFF_LEAD_MINUTES } from './sites/forebet-kickoff.mjs';

const now = new Date(2026, 7, 20, 9, 30); // 20/08/2026 09:30 — фиксированная точка отсчёта для теста

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} -> ${JSON.stringify(actual)} (expected ${JSON.stringify(expected)})`);
  if (!ok) failed++;
}

// parseKickoffText
check('корректный формат', parseKickoffText('20/08/2026 12:00')?.getHours(), 12);
check('день/месяц не перепутаны (13-е число)', parseKickoffText('13/08/2026 09:00')?.getDate(), 13);
check('null на пустой строке', parseKickoffText(''), null);
check('null на null', parseKickoffText(null), null);
check('null на мусоре', parseKickoffText('bad format'), null);
check('null на месяце вне диапазона (13)', parseKickoffText('20/13/2026 12:00'), null);
check('null на дне вне диапазона (32)', parseKickoffText('32/08/2026 12:00'), null);
check('null на часе вне диапазона (25)', parseKickoffText('20/08/2026 25:00'), null);
check('null на минуте вне диапазона (60)', parseKickoffText('20/08/2026 12:60'), null);

// mayHaveStarted — с учётом запаса KICKOFF_LEAD_MINUTES=180 (3 часа) от now=09:30
check('матч на 12:00 (через 2.5ч, внутри запаса) -> true', mayHaveStarted('20/08/2026 12:00', now), true);
check('матч на 20:00 (через 10.5ч, вне запаса) -> false', mayHaveStarted('20/08/2026 20:00', now), false);
check('матч вчера вечером -> true', mayHaveStarted('19/08/2026 23:00', now), true);
check('null kickoffText -> true (fail-open)', mayHaveStarted(null, now), true);
check('невалидный формат -> true (fail-open)', mayHaveStarted('bad format', now), true);
check('семантически некорректная дата -> true (fail-open, не Invalid Date)', mayHaveStarted('32/13/2026 99:99', now), true);

console.log(`\nKICKOFF_LEAD_MINUTES = ${KICKOFF_LEAD_MINUTES}`);

if (failed > 0) {
  console.log(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll tests passed');
