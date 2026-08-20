// Журнал сработавших алертов (см. Plan.md, 1.3: формат по умолчанию — JSON
// в data/, 2.1: сущность Alert). Один файл на день, каждый алерт — отдельная
// запись с полем outcome для последующей ручной простановки исхода (шаг 6).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');

function logPathForToday() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(DATA_DIR, `alerts-${today}.json`);
}

async function readLog(filePath) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Добавляет запись алерта в журнал сегодняшнего дня. Возвращает id записи
// (индекс в файле) — используется потом для простановки исхода.
export async function appendAlert({ matchId, homeTeam, awayTeam, checkpoint, minute, score, homeShots, awayShots }) {
  await mkdir(DATA_DIR, { recursive: true });
  const filePath = logPathForToday();
  const log = await readLog(filePath);

  const entry = {
    id: log.length,
    matchId,
    homeTeam,
    awayTeam,
    checkpoint,
    minute,
    score,
    homeShots,
    awayShots,
    sentAt: new Date().toISOString(),
    outcome: 'pending', // pending | goal_followed | no_goal (см. Plan.md, 2.1)
  };

  log.push(entry);
  await writeFile(filePath, JSON.stringify(log, null, 2));
  return entry.id;
}

// Ручная простановка исхода (см. Plan.md, шаг 5, открытый вопрос — формат
// закрыт как явная функция + CLI-обвязка в set-outcome.mjs).
export async function setOutcome(date, id, outcome) {
  if (!['goal_followed', 'no_goal'].includes(outcome)) {
    throw new Error(`Недопустимый outcome: ${outcome} (ожидается goal_followed | no_goal)`);
  }
  const filePath = path.join(DATA_DIR, `alerts-${date}.json`);
  const log = await readLog(filePath);
  const entry = log.find((e) => e.id === id);
  if (!entry) throw new Error(`Алерт id=${id} не найден в ${filePath}`);
  entry.outcome = outcome;
  await writeFile(filePath, JSON.stringify(log, null, 2));
  return entry;
}
