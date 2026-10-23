import { useEffect, useState } from 'react';
import type { CashSession, Session, TournamentSession } from '../db/schema';
import { lastOfKind } from '../lib/actions';
import { cashBuyInTotal, hoursPlayed, sessionTime, stakeLabel } from '../lib/calc';
import { headline, subline, useData } from '../lib/data';
import { clock, money, signed, tone } from '../lib/format';
import { cumulative, currentBankroll, totals } from '../lib/stats';
import { BackupBanner, InstallBanner, backupDue } from '../components/Banners';
import { Sparkline } from '../components/charts/Sparkline';
import { SessionRow } from '../components/SessionRow';
import { Sheet, Top, useNow } from '../components/ui';

const DAY = 86_400_000;

export function Home() {
  const { sessions, transactions, settings, venueById, loaded } = useData();
  const now = useNow(1000);
  const [lastCash, setLastCash] = useState<CashSession>();
  const [lastMtt, setLastMtt] = useState<TournamentSession>();
  const [addPast, setAddPast] = useState(false);
  useEffect(() => {
    lastOfKind('cash').then(setLastCash);
    lastOfKind('tournament').then(setLastMtt);
  }, [sessions.length]);

  if (!loaded) return null;
  const live = sessions.filter((s) => s.status === 'live');
  const done = sessions.filter((s) => s.status === 'done');
  const last30 = totals(done.filter((s) => sessionTime(s) > Date.now() - 30 * DAY));
  const ytd = totals(done.filter((s) => new Date(sessionTime(s)).getFullYear() === new Date().getFullYear()));
  const bankroll = currentBankroll(sessions, transactions, settings.startingBankroll);
  const recent = [...done].sort((a, b) => sessionTime(b) - sessionTime(a)).slice(0, 5);

  return (
    <>
      <Top title="Felt" />
      <InstallBanner />
      {backupDue(settings, done.length, 14) && <BackupBanner settings={settings} />}

      {live.map((s) => (
        <LiveCard key={s.id} s={s} now={now} venue={subline(s, venueById)} />
      ))}

      <div className="grid2" style={{ marginBottom: 12 }}>
        <a className="btn huge primary" href="#/new/cash">
          Cash game
          <small>{lastCash ? `${lastCash.game} ${stakeLabel(lastCash)}` : 'Start session'}</small>
        </a>
        <a className="btn huge primary" href="#/new/tournament">
          Tournament
          <small>{lastMtt ? money(lastMtt.buyIn + lastMtt.fee, lastMtt.currency) + (lastMtt.eventName ? ` · ${lastMtt.eventName}` : '') : 'Start tournament'}</small>
        </a>
      </div>

      {done.length > 0 ? (
        <>
          <a className="card" href="#/stats" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div className="hero-label">{new Date().getFullYear()} result</div>
            <div className={`hero ${tone(ytd.result)}`} style={{ fontSize: 40 }}>
              {signed(ytd.result, true)}
            </div>
            <div className="hint" style={{ marginBottom: 8 }}>
              Last 30 days <span className={tone(last30.result)}>{signed(last30.result, true)}</span> · Bankroll {money(Math.round(bankroll))}
            </div>
            <Sparkline points={cumulative(done)} />
          </a>
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Recent</span>
            <a href="#/history" style={{ textTransform: 'none', letterSpacing: 0 }}>
              All sessions
            </a>
          </div>
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <ul className="list">
              {recent.map((s) => (
                <SessionRow key={s.id} s={s} venueById={venueById} />
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="card empty">
          <p style={{ margin: '0 0 6px', color: 'var(--ink)', fontWeight: 600 }}>No sessions yet</p>
          Start one when you sit down, or add a past one.
        </div>
      )}
      <button className="btn ghost block" onClick={() => setAddPast(true)}>
        + Add a past session
      </button>
      {addPast && (
        <Sheet title="Add a past session" onClose={() => setAddPast(false)}>
          <div className="grid2">
            <a className="btn big" href="#/add/cash">
              Cash game
            </a>
            <a className="btn big" href="#/add/tournament">
              Tournament
            </a>
          </div>
        </Sheet>
      )}
    </>
  );
}

function LiveCard({ s, now, venue }: { s: Session; now: number; venue: string }) {
  const amount = s.kind === 'cash' ? `In ${money(cashBuyInTotal(s), s.currency)}` : `${s.entries}× entry`;
  return (
    <a className="live-card" href={`#/live/${s.id}`}>
      <div className="t">
        ● LIVE · {headline(s)}
        {venue ? ` · ${venue}` : ''}
      </div>
      <div className="b">
        <span className="tnum">{clock(hoursPlayed(s, now))}</span>
        <span>{amount} ›</span>
      </div>
    </a>
  );
}
