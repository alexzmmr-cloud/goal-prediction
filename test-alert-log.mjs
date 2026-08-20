import { appendAlert, setOutcome } from './alert-log.mjs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

// Тестовый прогон журнала без реального Telegram — проверяем только запись/чтение/simple outcome.
const today = new Date().toISOString().slice(0, 10);
const filePath = path.join(process.cwd(), 'data', `alerts-${today}.json`);

// Чистое состояние перед тестом (не трогаем чужие данные — файл специфичен для сегодняшней даты теста).
await rm(filePath, { force: true });

const id1 = await appendAlert({
  matchId: '2483526', homeTeam: 'Deportivo Achuapa', awayTeam: 'Peten',
  checkpoint: 50, minute: 51, score: '0-0', homeShots: 3, awayShots: 0,
});
console.log('Записан алерт id=', id1);

const id2 = await appendAlert({
  matchId: '2519182', homeTeam: 'Neftohimik Burgas', awayTeam: 'FK Sozopol',
  checkpoint: 60, minute: 62, score: '1-1', homeShots: 0, awayShots: 4,
});
console.log('Записан алерт id=', id2);

let log = JSON.parse(await readFile(filePath, 'utf-8'));
console.log('Журнал после двух записей:', JSON.stringify(log, null, 2));

if (log.length !== 2 || log[0].outcome !== 'pending' || log[1].outcome !== 'pending') {
  console.log('FAIL: ожидалось 2 записи со статусом pending');
  process.exit(1);
}

await setOutcome(today, id1, 'goal_followed');
log = JSON.parse(await readFile(filePath, 'utf-8'));
console.log('После setOutcome(id1, goal_followed):', log[0].outcome);

if (log[0].outcome !== 'goal_followed' || log[1].outcome !== 'pending') {
  console.log('FAIL: outcome не проставился корректно');
  process.exit(1);
}

try {
  await setOutcome(today, id1, 'bad_value');
  console.log('FAIL: ожидалась ошибка на недопустимый outcome');
  process.exit(1);
} catch (err) {
  console.log('OK: недопустимый outcome отклонён:', err.message);
}

console.log('\nAll alert-log tests passed');
