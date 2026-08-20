import {
  evaluateAlert,
  isLowScore,
  FIRST_HALF_SHOTS_THRESHOLD,
  SECOND_HALF_SHOTS_THRESHOLD,
} from './alert-rule.mjs';

const cases = [
  // 1-й тайм: список "низких" строго {0-0}, порог FIRST_HALF_SHOTS_THRESHOLD (2)
  { name: '1T: 0-0 + порог пробит (хозяева)', half: 1, stats: { status: 'ok', score: '0-0', home: { shotsOnGoal: 3 }, away: { shotsOnGoal: 0 } }, expectAlert: true },
  { name: '1T: 0-0, порог НЕ пробит (ровно 2)', half: 1, stats: { status: 'ok', score: '0-0', home: { shotsOnGoal: 2 }, away: { shotsOnGoal: 2 } }, expectAlert: false },
  { name: '1T: счёт 1-0 — вне диапазона (для 1-го тайма это уже не "низкий")', half: 1, stats: { status: 'ok', score: '1-0', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 0 } }, expectAlert: false },

  // 2-й тайм: список "низких" {0-0,0-1,1-1,1-0}, порог SECOND_HALF_SHOTS_THRESHOLD (4)
  { name: '2T: 1-0 + порог пробит (хозяева, 5>4)', half: 2, stats: { status: 'ok', score: '1-0', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 0 } }, expectAlert: true },
  { name: '2T: 0-1, порог НЕ пробит (ровно 4)', half: 2, stats: { status: 'ok', score: '0-1', home: { shotsOnGoal: 4 }, away: { shotsOnGoal: 0 } }, expectAlert: false },
  { name: '2T: 0-0, порог НЕ пробит (3, было бы достаточно в 1-м тайме)', half: 2, stats: { status: 'ok', score: '0-0', home: { shotsOnGoal: 3 }, away: { shotsOnGoal: 0 } }, expectAlert: false },
  { name: '2T: счёт вне диапазона (2-1), порог пробит', half: 2, stats: { status: 'ok', score: '2-1', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 0 } }, expectAlert: false },

  // Сбои источника — не зависят от half
  { name: 'недоступность Forebet (error)', half: 2, stats: { status: 'no_stats_response' }, expectAlert: false },
  { name: 'нет данных от провайдера', half: 2, stats: { status: 'no_data' }, expectAlert: false },
];

let failed = 0;
for (const c of cases) {
  const result = evaluateAlert(c.stats, c.half);
  const ok = result.alert === c.expectAlert;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name} -> alert=${result.alert} (reason=${result.reason})`);
  if (!ok) failed++;
}

console.log('---');
console.log('isLowScore tests:');
console.log('half=1, 0-0 ->', isLowScore('0-0', 1), '(expect true)');
console.log('half=1, 1-0 ->', isLowScore('1-0', 1), '(expect false — 1-й тайм только 0:0)');
console.log('half=2, 1-0 ->', isLowScore('1-0', 2), '(expect true)');
console.log('half=2, 2-0 ->', isLowScore('2-0', 2), '(expect false)');
console.log('null ->', isLowScore(null), '(expect false)');
console.log('FIRST_HALF_SHOTS_THRESHOLD =', FIRST_HALF_SHOTS_THRESHOLD);
console.log('SECOND_HALF_SHOTS_THRESHOLD =', SECOND_HALF_SHOTS_THRESHOLD);

if (failed > 0) {
  console.log(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll tests passed');
