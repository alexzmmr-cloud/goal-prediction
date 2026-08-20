import { Telegraf } from 'telegraf';

// Токен и chat id читаются из .env (см. .env.example) — не хардкодить,
// не печатать, не коммитить (см. Plan.md, раздел 1 "Секреты").
export function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN не задан — см. .env.example');
  }
  return new Telegraf(token);
}

export function formatAlertMessage({ homeTeam, awayTeam, checkpoint, minute, score, homeShots, awayShots }) {
  return [
    `⚠️ ${homeTeam} — ${awayTeam}`,
    `Счёт: ${score}, минута: ${minute}' (отметка ${checkpoint}')`,
    `Удары в створ: ${homeTeam} ${homeShots} — ${awayShots} ${awayTeam}`,
  ].join('\n');
}

export async function sendAlert(bot, chatId, alertData) {
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID не задан — см. .env.example');
  }
  const text = formatAlertMessage(alertData);
  await bot.telegram.sendMessage(chatId, text);
  return text;
}

// Служебные сообщения о жизненном цикле процесса (не про конкретный матч) —
// старт/финиш/аварийная остановка. Пользователь работает с закрытой крышкой
// ноутбука на внешнем мониторе и не смотрит в терминал, поэтому не должен
// узнавать о падении процесса только по тишине в Telegram.
export async function sendStatus(bot, chatId, text) {
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID не задан — см. .env.example');
  }
  await bot.telegram.sendMessage(chatId, text);
  return text;
}
