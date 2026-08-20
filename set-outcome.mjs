import { setOutcome } from './alert-log.mjs';

// Ручная простановка исхода сработавшего алерта (см. Plan.md, шаг 5, открытый
// вопрос про формат простановки — закрыт как CLI поверх alert-log.mjs, без
// Telegram-команды: для личного некоммерческого MVP один процесс без
// постоянно слушающего бота проще, чем поднимать webhook/long-polling ради
// одной вспомогательной команды).
//
// Usage: node set-outcome.mjs <date:YYYY-MM-DD> <id> <goal_followed|no_goal>

const [date, idRaw, outcome] = process.argv.slice(2);

if (!date || idRaw === undefined || !outcome) {
  console.error('Usage: node set-outcome.mjs <date:YYYY-MM-DD> <id> <goal_followed|no_goal>');
  process.exit(1);
}

const id = Number(idRaw);
if (!Number.isInteger(id)) {
  console.error(`id должен быть целым числом, получено: ${idRaw}`);
  process.exit(1);
}

try {
  const entry = await setOutcome(date, id, outcome);
  console.log('Исход проставлен:', JSON.stringify(entry, null, 2));
} catch (err) {
  console.error('Ошибка:', err.message);
  process.exit(1);
}
