import { withStealthPage } from './browser-stealth.mjs';

await withStealthPage('https://www.forebet.com/en/live-football-tips', async (page) => {
  const matches = await page.evaluate(() => {
    const rows = document.querySelectorAll('.rcnt');
    return Array.from(rows).map((row) => {
      const home = row.querySelector('.homeTeam [itemprop="name"]')?.textContent?.trim();
      const away = row.querySelector('.awayTeam [itemprop="name"]')?.textContent?.trim();
      const link = row.querySelector('a[href*="/football/matches/"]')?.href;
      const m = link ? link.match(/-(\d+)(?:[/?#]|$)/) : null;
      return { home, away, link, matchId: m ? m[1] : null };
    });
  });
  console.log(JSON.stringify(matches, null, 2));
}, { timeout: 45000 });
