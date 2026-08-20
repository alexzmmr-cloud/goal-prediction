import { createMatchWatch, pollMatch } from './scheduler.mjs';

// Проверяет замечание ревью шага 3: планировщик впервые опрашивает матч,
// который уже во 2-м тайме (поздний старт процесса) — 15' не должна
// засчитываться как честно проверенная с данными случайной поздней минуты,
// а должна попасть в skippedCheckpoints.

const url = process.argv[2];
const matchId = process.argv[3];
if (!url || !matchId) {
  console.error('Usage: node test-scheduler-late-start.mjs <matchUrl> <matchId>');
  process.exit(1);
}

const watch = createMatchWatch({ matchUrl: url, matchId, homeTeam: 'Test Home', awayTeam: 'Test Away' });

const result = await pollMatch(watch, {
  onCheckpoint: (w, r) => console.log(`[CHECKPOINT ${r.checkpoint}'] минута=${r.minute} — засчитан (не должно случиться для 15' на позднем старте)`),
  onSkip: (w, r) => console.log(`[SKIP ${r.checkpoint}'] минута=${r.minute} — пропущена как нечестная`),
});

console.log('Результат опроса:', result);
console.log('checkedCheckpoints:', watch.checkedCheckpoints);
console.log('skippedCheckpoints:', watch.skippedCheckpoints);

if (watch.skippedCheckpoints.includes(15) && !watch.checkedCheckpoints.includes(15)) {
  console.log('OK: 15\' корректно пропущена при позднем старте');
} else {
  console.log('FAIL: 15\' не была пропущена как ожидалось');
  process.exit(1);
}
