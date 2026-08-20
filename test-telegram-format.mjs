import { formatAlertMessage, createBot, sendAlert, sendStatus } from './telegram.mjs';

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

// sendAlert/sendStatus должны падать без TELEGRAM_CHAT_ID, не дожидаясь
// реального сетевого запроса (bot передаём заглушкой — до chatId-проверки
// код не должен добраться к bot.telegram).
const fakeBot = { telegram: { sendMessage: () => { throw new Error('не должно быть вызвано без chatId'); } } };

try {
  await sendAlert(fakeBot, undefined, { homeTeam: 'A', awayTeam: 'B', checkpoint: 50, minute: 51, score: '0-0', homeShots: 3, awayShots: 0 });
  console.log('FAIL: sendAlert должен был упасть без chatId');
  process.exit(1);
} catch (err) {
  console.log('OK: sendAlert без chatId корректно падает:', err.message);
}

try {
  await sendStatus(fakeBot, undefined, 'test');
  console.log('FAIL: sendStatus должен был упасть без chatId');
  process.exit(1);
} catch (err) {
  console.log('OK: sendStatus без chatId корректно падает:', err.message);
}
