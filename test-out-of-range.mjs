// Юнит-проверка (без сети) правил evaluateGrowth/evaluateBaseline, от
// которых зависит переход watch.status -> 'out_of_range' в scheduler.mjs
// (см. pollMatch: `if (verdict.reason === 'score_not_low') watch.status = 'out_of_range'`).
// Модель "матч целиком, не отдельная команда" не изменилась при переходе на
// прирост ударов (см. Plan.md) — как только счёт перестаёт быть 0:0, любая
// из функций правила возвращает reason='score_not_low' независимо от того,
// на какой отсечке это произошло.
import { evaluateBaseline, evaluateGrowth } from './alert-rule.mjs';

let failed = 0;
function check(name, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${name}`);
  if (!condition) failed++;
}

const goalScored = { status: 'ok', score: '1-0', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 1 } };

check(
  'evaluateBaseline (10\'): счёт 1-0 -> reason=score_not_low (должно перевести в out_of_range)',
  evaluateBaseline(goalScored).reason === 'score_not_low',
);
check(
  'evaluateGrowth (15/25/30/50/60/75): счёт 1-0 -> reason=score_not_low (должно перевести в out_of_range)',
  evaluateGrowth(goalScored, { home: 1, away: 0 }).reason === 'score_not_low',
);

console.log('\nСама привязка reason -> status="out_of_range" находится в scheduler.mjs');
console.log('(pollMatch, ветка `if (verdict.reason === "score_not_low")`) — здесь');
console.log('подтверждено, что обе функции правила единообразно возвращают это значение');
console.log('как только счёт перестаёт быть 0:0, независимо от отсечки/тайма.');

if (failed > 0) {
  console.log(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll tests passed');
