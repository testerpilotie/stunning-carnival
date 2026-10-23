# Felt: live poker tracker

An offline-first web app (PWA) for logging live cash games and tournaments from your phone at the table. Your data stays on the device. Backups go to Files / iCloud Drive / Google Drive with one tap.

## What it does

- **Fast logging.** Start a session in two taps: venue, game, stakes and buy-in are prefilled from last time. While live there are big buttons for rebuy (same amount, one tap, with undo), stack check, break, and cash out. For tournaments: re-entry, add-on, bounty, busted / cashed. Every tap is saved, so closing the app or rebooting the phone loses nothing.
- **Tournaments first-class.** Buy-in split into prize pool and fee, re-entries (buy-in + fee each), rebuys (cost you enter, no fee), add-ons, bounties, finish position vs field size, guarantee, and format tags.
- **Stats.**
  - €/h and big blinds per hour, overall and by blind size, and a 95% confidence interval on your true hourly rate. It tells you whether your sample can already separate a winner from a loser.
  - Max downswing and its dates.
  - Monthly results and results by weekday.
  - ROI and ITM, ROI by buy-in band, and a finish-position histogram.
  - Breakdowns by stake, venue, country, format and session length.
  - Filters for date range, type, venue, game, stake, buy-in band and tag.
- **Travel.** Each session has its own currency and a fixed FX rate to EUR, which you can fetch with one tap when online. All stats are in EUR.
- **Bankroll.** Starting amount, deposits and withdrawals, and a bankroll graph.
- **Your data.** JSON backup and restore, plus CSV export (semicolon-separated with decimal commas, so it opens cleanly in Finnish-locale Sheets and Excel).

## Install on your phone

1. Open the app URL. **iPhone:** use Safari, then Share → **Add to Home Screen**. **Android:** use Chrome, then ⋮ → **Install app**.
2. From then on, always open Felt from the home-screen icon. On iOS this matters: Safari deletes data of *websites* not opened for 7 days. Home-screen apps are exempt.
3. After a session, when the app shows *Save backup*, tap it and save to iCloud Drive / Google Drive. If you change phones: Settings → Restore.

## Hosting

### GitHub Pages (automatic)
`.github/workflows/deploy.yml` builds and deploys on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The URL is `https://<user>.github.io/<repo>/`.
GitHub Pages for a **private** repo needs a paid GitHub plan. On a free plan, either make the repo public (it contains only code; your poker data never leaves your phone) or use the VPS option.

### Your own VPS (nginx)
```bash
npm ci && npm run build          # produces dist/
rsync -av --delete dist/ user@your-vps:/var/www/felt/
```
nginx server block (HTTPS is required for install and offline use):
```nginx
server {
    server_name poker.example.com;
    root /var/www/felt;
    location / { try_files $uri /index.html; }
    location = /sw.js { add_header Cache-Control "no-cache"; }
}
```
Then `sudo certbot --nginx -d poker.example.com`.

## Development
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the money / stats maths
npm run build      # typecheck + production build into dist/
```

Stack: Vite, React, TypeScript, Dexie (IndexedDB), vite-plugin-pwa. Charts are hand-rolled SVG. The code is organised as follows:

| Path | Contents |
|------|----------|
| `src/db/` | Schema, database, backup / restore / CSV |
| `src/lib/calc.ts` | Per-session maths (result, hours excl. breaks, cost, FX) |
| `src/lib/stats.ts` | Aggregates, drawdown, hourly confidence interval, ROI bands |
| `src/screens/` | One file per screen |
| `src/components/charts/` | Line, bar, sparkline |
