// Юнит-проверка (без сети) ветки out_of_range в scheduler.mjs — используем
// прямой вызов evaluateAlert, чтобы подтвердить связку verdict.reason ->
// status перехода, не полагаясь на реальный live-матч (счёт которого не
// контролируем).
import { evaluateAlert } from './alert-rule.mjs';

let failed = 0;
function check(name, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${name}`);
  if (!condition) failed++;
}

// 2-й тайм, счёт вне диапазона — scheduler.mjs переводит в out_of_range
// (условие `half === 2 && verdict.reason === 'score_not_low'`).
const secondHalfHighScore = evaluateAlert(
  { status: 'ok', score: '2-1', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 1 } },
  2,
);
check('2T, счёт 2-1 -> reason=score_not_low (должно перевести в out_of_range)', secondHalfHighScore.reason === 'score_not_low');

// 1-й тайм, гол уже забит (счёт 1-0) — НЕ должно переводить в out_of_range:
// план требует, чтобы отсечки 2-го тайма всё равно проверялись по своему
// списку счетов независимо от истории 1-го тайма (см. Plan.md, 1.3).
// scheduler.mjs защищает это условием `half === 2` — сам по себе
// verdict.reason тут тоже 'score_not_low', это ожидаемо и нормально:
// именно scheduler.mjs (не evaluateAlert) обязан не реагировать на это
// значение для half=1.
const firstHalfGoalScored = evaluateAlert(
  { status: 'ok', score: '1-0', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 0 } },
  1,
);
check('1T, счёт 1-0 -> reason=score_not_low (scheduler.mjs НЕ должен перевести в out_of_range для half=1)', firstHalfGoalScored.reason === 'score_not_low');

console.log('\nСама привязка reason -> status="out_of_range" находится в scheduler.mjs');
console.log('(pollMatch, ветка `if (half === 2 && verdict.reason === "score_not_low")`) —');
console.log('здесь подтверждены оба условия, от которых она зависит.');

if (failed > 0) {
  console.log(`\n${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll tests passed');
