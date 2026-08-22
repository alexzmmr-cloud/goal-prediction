import { createMatchWatch, pollMatch, FIRST_HALF_CHECKPOINTS, SECOND_HALF_CHECKPOINTS } from './scheduler.mjs';

// Укороченный тестовый прогон (см. Plan.md, шаг 3, "Проверка"): подменяем
// реальные контрольные точки на маленькие числа, чтобы не ждать 90 минут
// реального матча — планировщик должен сработать почти сразу на текущей
// минуте идущего матча.
FIRST_HALF_CHECKPOINTS.length = 0;
FIRST_HALF_CHECKPOINTS.push(1, 2, 3); // заведомо меньше текущей минуты любого live-матча
SECOND_HALF_CHECKPOINTS.length = 0;

const url = process.argv[2];
const matchId = process.argv[3];
if (!url || !matchId) {
  console.error('Usage: node test-scheduler.mjs <matchUrl> <matchId>');
  process.exit(1);
}

const watch = createMatchWatch({
  matchUrl: url,
  matchId,
  homeTeam: 'Test Home',
  awayTeam: 'Test Away',
});

console.log('Начальное состояние:', JSON.stringify(watch, null, 2));

for (let i = 0; i < FIRST_HALF_CHECKPOINTS.length + 1; i++) {
  const result = await pollMatch(watch, {
    onCheckpoint: (w, r) => console.log(`[CHECKPOINT ${r.checkpoint}'] минута=${r.minute}, isError=${r.isError}, verdict=`, JSON.stringify(r.verdict)),
  });
  console.log(`Опрос ${i + 1}: результат=${result ? 'сработал' : 'null (рано или уже done)'}, статус матча=${watch.status}, пройдено=${JSON.stringify(watch.checkedCheckpoints)}`);
  if (watch.status === 'done') break;
}

console.log('Финальное состояние:', JSON.stringify(watch, null, 2));
