// Юнит-проверка (без сети) исключения матча по подряд идущим ошибкам
// статистики. Вызывает ту же функцию applyErrorTracking, что использует
// pollMatch — не копию логики, чтобы изменение в scheduler.mjs автоматически
// ловилось этим тестом, а не расходилось молча с копипастой.
import { createMatchWatch, applyErrorTracking, CONSECUTIVE_ERRORS_TO_EXCLUDE } from './scheduler.mjs';

let failed = 0;
function check(name, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${name}`);
  if (!condition) failed++;
}

check('CONSECUTIVE_ERRORS_TO_EXCLUDE экспортирован и равен 2', CONSECUTIVE_ERRORS_TO_EXCLUDE === 2);

function runSequence(errorFlags) {
  const watch = createMatchWatch({ matchUrl: 'x', matchId: '1', homeTeam: 'A', awayTeam: 'B' });
  for (const isError of errorFlags) applyErrorTracking(watch, isError);
  return watch;
}

check('1 ошибка подряд -> статус остаётся watching', runSequence([true]).status === 'watching');
check('2 ошибки подряд -> статус excluded_no_data', runSequence([true, true]).status === 'excluded_no_data');
check('ошибка-успех-ошибка (счётчик сбрасывается) -> статус остаётся watching', runSequence([true, false, true]).status === 'watching');
check('ошибка-успех-ошибка-ошибка -> статус excluded_no_data (2 подряд после сброса)', runSequence([true, false, true, true]).status === 'excluded_no_data');

if (failed > 0) {
  console.log(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll tests passed');
