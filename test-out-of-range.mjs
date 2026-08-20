// Юнит-проверка (без сети) ветки out_of_range в scheduler.mjs — используем
// прямой вызов evaluateAlert, чтобы подтвердить связку verdict.reason ->
// status перехода, не полагаясь на реальный live-матч (счёт которого не
// контролируем).
import { evaluateAlert } from './alert-rule.mjs';

const highScoreStats = { status: 'ok', score: '2-1', home: { shotsOnGoal: 5 }, away: { shotsOnGoal: 1 } };
const verdict = evaluateAlert(highScoreStats);

console.log('verdict для счёта 2-1:', JSON.stringify(verdict));

if (verdict.reason !== 'score_not_low') {
  console.log('FAIL: ожидался reason=score_not_low для счёта вне диапазона');
  process.exit(1);
}

// Сама привязка reason -> status='out_of_range' находится в scheduler.mjs
// (pollMatch, ветка `if (verdict.reason === 'score_not_low')`) — здесь
// подтверждаем то единственное условие, от которого она зависит.
console.log('OK: verdict.reason === "score_not_low" — ровно то условие, на которое реагирует scheduler.mjs, переводя watch.status в out_of_range');
