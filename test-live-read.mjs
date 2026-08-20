import { withPage } from './browser.mjs';
import { readCurrentMinute, readLiveStats } from './sites/forebet-live.mjs';

const url = process.argv[2];
const matchId = process.argv[3];
if (!url || !matchId) {
  console.error('Usage: node test-live-read.mjs <matchUrl> <matchId>');
  process.exit(1);
}

await withPage(url, async (page) => {
  const minute = await readCurrentMinute(page);
  console.log('Текущая минута:', minute);

  const stats = await readLiveStats(page, matchId);
  console.log('Статистика:', JSON.stringify(stats, null, 2));
}, { timeout: 45000 });
