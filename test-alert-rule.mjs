import { evaluateAlert, isLowScore, SHOTS_ON_GOAL_THRESHOLD } from './alert-rule.mjs';

const cases = [
  { name: 'низкий счёт + порог пробит (хозяева)', stats: { status: 'ok', score: '0-0', home: { shotsOnGoal: 3 }, away: { shotsOnGoal: 0 } }, expectAlert: true },
  { name: 'низкий счёт + порог пробит (гости)', stats: { status: 'ok', score: '1-1', home: { shotsOnGoal: 0 }, away: { shotsOnGoal: 3 } }, expectAlert: true },
  { name: 'низкий счёт, порог НЕ пробит (ровно 2)', stats: { status: 'ok', score: '0-1', home: { shotsOnGoal: 2 }, away: { shotsOnGoal: 2 } }, expectAlert: false },
  { name: 'счёт вне диапазона (2-1), порог пробит', stats: { status: 'ok', score: '2-1', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 0 } }, expectAlert: false },
  { name: 'недоступность Forebet (error)', stats: { status: 'no_stats_response' }, expectAlert: false },
  { name: 'нет данных от провайдера', stats: { status: 'no_data' }, expectAlert: false },
];

let failed = 0;
for (const c of cases) {
  const result = evaluateAlert(c.stats);
  const ok = result.alert === c.expectAlert;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name} -> alert=${result.alert} (reason=${result.reason})`);
  if (!ok) failed++;
}

console.log('---');
console.log('isLowScore tests:');
console.log('0-0 ->', isLowScore('0-0'), '(expect true)');
console.log('1-0 ->', isLowScore('1-0'), '(expect true)');
console.log('2-0 ->', isLowScore('2-0'), '(expect false)');
console.log('null ->', isLowScore(null), '(expect false)');
console.log('threshold =', SHOTS_ON_GOAL_THRESHOLD);

if (failed > 0) {
  console.log(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll tests passed');
