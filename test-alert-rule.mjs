import {
  evaluateBaseline,
  evaluateGrowth,
  isReadyForSecondHalf,
  FIRST_CHECKPOINT_SHOTS_THRESHOLD,
  GROWTH_SHOTS_THRESHOLD,
  SECOND_HALF_ENTRY_SHOTS_THRESHOLD,
} from './alert-rule.mjs';

let failed = 0;
function check(name, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${name}`);
  if (!condition) failed++;
}

console.log('evaluateBaseline (10\', абсолютный порог):');
check(
  'порог пробит (хозяева, 1 удар)',
  evaluateBaseline({ status: 'ok', score: '0-0', home: { shotsOnGoal: 1 }, away: { shotsOnGoal: 0 } }).alert === true,
);
check(
  'порог НЕ пробит (0 ударов у обеих)',
  evaluateBaseline({ status: 'ok', score: '0-0', home: { shotsOnGoal: 0 }, away: { shotsOnGoal: 0 } }).alert === false,
);
check(
  'счёт 1-0 — вне диапазона',
  evaluateBaseline({ status: 'ok', score: '1-0', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 0 } }).reason === 'score_not_low',
);
check(
  'недоступность Forebet',
  evaluateBaseline({ status: 'no_stats_response' }).alert === false,
);

console.log('---');
console.log('evaluateGrowth (15/25/30/50/60/75, прирост от последней отсечки):');
check(
  'прирост есть (было 1, стало 2 у хозяев)',
  evaluateGrowth({ status: 'ok', score: '0-0', home: { shotsOnGoal: 2 }, away: { shotsOnGoal: 0 } }, { home: 1, away: 0 }).alert === true,
);
check(
  'прироста нет (то же число, что и раньше)',
  evaluateGrowth({ status: 'ok', score: '0-0', home: { shotsOnGoal: 1 }, away: { shotsOnGoal: 0 } }, { home: 1, away: 0 }).reason === 'no_growth',
);
check(
  'прирост у гостей засчитывается тоже (OR по командам)',
  evaluateGrowth({ status: 'ok', score: '0-0', home: { shotsOnGoal: 1 }, away: { shotsOnGoal: 3 } }, { home: 1, away: 2 }).alert === true,
);
check(
  'счёт вышел из 0:0 — no alert, reason=score_not_low',
  evaluateGrowth({ status: 'ok', score: '1-0', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 0 } }, { home: 1, away: 0 }).reason === 'score_not_low',
);
check(
  'нет базы (lastShots не передан) — считается от 0, любой удар это прирост',
  evaluateGrowth({ status: 'ok', score: '0-0', home: { shotsOnGoal: 1 }, away: { shotsOnGoal: 0 } }, null).alert === true,
);

console.log('---');
console.log('isReadyForSecondHalf (30\', абсолютный порог для входа во 2-й тайм):');
check(
  'порог пробит (хозяева, 4 > 3)',
  isReadyForSecondHalf({ status: 'ok', score: '0-0', home: { shotsOnGoal: 4 }, away: { shotsOnGoal: 0 } }) === true,
);
check(
  'порог НЕ пробит (ровно 3, строго больше нужно)',
  isReadyForSecondHalf({ status: 'ok', score: '0-0', home: { shotsOnGoal: 3 }, away: { shotsOnGoal: 3 } }) === false,
);
check(
  'счёт не 0:0 — false независимо от ударов',
  isReadyForSecondHalf({ status: 'ok', score: '1-0', home: { shotsOnGoal: 10 }, away: { shotsOnGoal: 0 } }) === false,
);
check(
  'нет данных — false',
  isReadyForSecondHalf({ status: 'no_data' }) === false,
);

console.log('---');
console.log('FIRST_CHECKPOINT_SHOTS_THRESHOLD =', FIRST_CHECKPOINT_SHOTS_THRESHOLD);
console.log('GROWTH_SHOTS_THRESHOLD =', GROWTH_SHOTS_THRESHOLD);
console.log('SECOND_HALF_ENTRY_SHOTS_THRESHOLD =', SECOND_HALF_ENTRY_SHOTS_THRESHOLD);

if (failed > 0) {
  console.log(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll tests passed');
