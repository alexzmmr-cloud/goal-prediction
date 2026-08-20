import { formatAlertMessage, createBot } from './telegram.mjs';

const msg = formatAlertMessage({
  homeTeam: 'Deportivo Achuapa', awayTeam: 'Peten',
  checkpoint: 50, minute: 51, score: '0-0', homeShots: 3, awayShots: 0,
});
console.log('--- Пример сообщения ---');
console.log(msg);

// createBot должен упасть без TELEGRAM_BOT_TOKEN — проверяем без реального токена.
delete process.env.TELEGRAM_BOT_TOKEN;
try {
  createBot();
  console.log('FAIL: ожидалась ошибка без токена');
  process.exit(1);
} catch (err) {
  console.log('OK: createBot без токена корректно падает:', err.message);
}
