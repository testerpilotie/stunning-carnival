import { useMemo, useState } from 'react';
import type { CashSession, Session, TournamentSession, Venue } from '../db/schema';
import { hoursPlayed, sessionTime, stakeLabel } from '../lib/calc';
import { useData } from '../lib/data';
import { date, hoursShort, money, monthLabel, moneyRound, number, percent, signed, signedPercent, tone, weekday } from '../lib/format';
import {
  BUY_IN_BANDS,
  bbPerHour,
  buyInBand,
  cumulative,
  drawdown,
  finishHistogram,
  groupBy,
  hourlyEstimate,
  monthly,
  totals,
  tournamentStats,
  type Group,
} from '../lib/stats';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { Seg, Tile, Top } from '../components/ui';

const DAY = 86_400_000;
type Range = 'all' | '30' | '90' | 'ytd' | '365' | 'lastyear';
type Tab = 'overview' | 'cash' | 'tournament' | 'venues';

interface Filters {
  range: Range;
  kind: 'all' | 'cash' | 'tournament';
  venue: string;
  game: string;
  stake: string;
  band: string;
  tag: string;
}

const EMPTY: Filters = { range: 'all', kind: 'all', venue: '', game: '', stake: '', band: '', tag: '' };

function inRange(t: number, r: Range): boolean {
  const now = new Date();
  switch (r) {
    case 'all':
      return true;
    case '30':
    case '90':
    case '365':
      return t > Date.now() - Number(r) * DAY;
    case 'ytd':
      return new Date(t).getFullYear() === now.getFullYear();
    case 'lastyear':
      return new Date(t).getFullYear() === now.getFullYear() - 1;
  }
}

function applyFilters(ss: Session[], f: Filters): Session[] {
  return ss.filter(
    (s) =>
      s.status === 'done' &&
      inRange(sessionTime(s), f.range) &&
      (f.kind === 'all' || s.kind === f.kind) &&
      (!f.venue || String(s.venueId ?? '') === f.venue) &&
      (!f.game || s.game === f.game) &&
      (!f.stake || (s.kind === 'cash' && stakeLabel(s) === f.stake)) &&
      (!f.band || (s.kind === 'tournament' && buyInBand(s) === f.band)) &&
      (!f.tag || s.tags.includes(f.tag)),
  );
}

export function Stats() {
  const { sessions, venues, venueById, loaded } = useData();
  const [f, setF] = useState<Filters>(() => {
    try {
      return { ...EMPTY, ...JSON.parse(sessionStorage.getItem('felt-filters') ?? '{}') };
    } catch {
      return EMPTY;
    }
  });
  const [tab, setTab] = useState<Tab>('overview');
  const update = (p: Partial<Filters>) => {
    const next = { ...f, ...p };
    setF(next);
    try {
      sessionStorage.setItem('felt-filters', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const done = sessions.filter((s) => s.status === 'done');
  const options = useMemo(() => {
    const cash = done.filter((s): s is CashSession => s.kind === 'cash');
    return {
      games: [...new Set(done.map((s) => s.game))].sort(),
      stakes: [...new Set(cash.map(stakeLabel))],
      tags: [...new Set(done.flatMap((s) => s.tags))].sort(),
      venues: venues.filter((v) => done.some((s) => s.venueId === v.id)),
    };
  }, [done, venues]);

  if (!loaded) return null;
  const filtered = applyFilters(sessions, f);
  const active = Object.entries(f).filter(([k, v]) => v !== EMPTY[k as keyof Filters]).length;

  return (
    <>
      <Top title="Stats" right={active ? <button className="btn ghost" style={{ minHeight: 40, padding: 0 }} onClick={() => update(EMPTY)}>Reset</button> : undefined} />
      <div className="filters">
        <Select value={f.range} on={(range) => update({ range: range as Range })} def="all" options={[
          ['all', 'All time'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['ytd', 'This year'], ['365', 'Last 12 months'], ['lastyear', 'Last year'],
        ]} />
        <Select value={f.kind} on={(kind) => update({ kind: kind as Filters['kind'], stake: '', band: '' })} def="all" options={[['all', 'Cash + MTT'], ['cash', 'Cash only'], ['tournament', 'Tournaments only']]} />
        {options.venues.length > 1 && <Select value={f.venue} on={(venue) => update({ venue })} def="" options={[['', 'All venues'], ...options.venues.map((v) => [String(v.id), v.name] as [string, string])]} />}
        {options.games.length > 1 && <Select value={f.game} on={(game) => update({ game })} def="" options={[['', 'All games'], ...options.games.map((g) => [g, g] as [string, string])]} />}
        {f.kind !== 'tournament' && options.stakes.length > 1 && <Select value={f.stake} on={(stake) => update({ stake })} def="" options={[['', 'All stakes'], ...options.stakes.map((s) => [s, s] as [string, string])]} />}
        {f.kind !== 'cash' && <Select value={f.band} on={(band) => update({ band })} def="" options={[['', 'All buy-ins'], ...BUY_IN_BANDS.map((b) => [b.label, b.label] as [string, string])]} />}
        {options.tags.length > 0 && <Select value={f.tag} on={(tag) => update({ tag })} def="" options={[['', 'All tags'], ...options.tags.map((t) => [t, `#${t}`] as [string, string])]} />}
      </div>
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'cash', label: 'Cash' },
          { value: 'tournament', label: 'MTT' },
          { value: 'venues', label: 'Venues' },
        ]}
      />
      <div style={{ height: 12 }} />
      {filtered.length === 0 ? (
        <div className="card empty">No finished sessions match these filters.</div>
      ) : tab === 'overview' ? (
        <Overview ss={filtered} showSplit={f.kind === 'all'} />
      ) : tab === 'cash' ? (
        <Cash ss={filtered.filter((s): s is CashSession => s.kind === 'cash')} venueById={venueById} />
      ) : tab === 'tournament' ? (
        <Tournaments ts={filtered.filter((s): s is TournamentSession => s.kind === 'tournament')} venueById={venueById} />
      ) : (
        <Venues ss={filtered} venueById={venueById} />
      )}
    </>
  );
}

function Select({ value, on, options, def }: { value: string; on: (v: string) => void; options: [string, string][]; def: string }) {
  return (
    <select className={value !== def ? 'on' : ''} value={value} onChange={(e) => on(e.target.value)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Overview({ ss, showSplit }: { ss: Session[]; showSplit: boolean }) {
  const t = totals(ss);
  const cum = cumulative(ss);
  const dd = drawdown(cum);
  const cash = ss.filter((s) => s.kind === 'cash');
  const mtt = ss.filter((s) => s.kind === 'tournament');
  const split = showSplit && cash.length > 0 && mtt.length > 0;
  const months = monthly(ss);
  const withExpenses = ss.filter((s) => s.expenses > 0).length;
  return (
    <>
      <div className="card">
        <div className="hero-label">Net result</div>
        <div className={`hero ${tone(t.result)}`}>{signed(t.result, true)}</div>
        <div className="hint" style={{ marginBottom: 12 }}>
          {t.sessions} sessions · {hoursShort(t.hours)}
        </div>
        <LineChart
          label="Cumulative result"
          format={(v) => signed(v, true)}
          area={!split}
          series={
            split
              ? [
                  { name: 'All', color: 'var(--series-1)', points: cum },
                  { name: 'Cash', color: 'var(--series-2)', points: cumulative(cash) },
                  { name: 'Tournaments', color: 'var(--series-3)', points: cumulative(mtt) },
                ]
              : [{ name: 'Result', color: 'var(--series-1)', points: cum }]
          }
        />
      </div>
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Per hour" value={t.perHour !== undefined ? signed(t.perHour, true) : '–'} toneClass={tone(t.perHour)} note="all play, per hour seated" />
        <Tile label="Winning sessions" value={percent(t.winningSessions / t.sessions)} note={`${t.winningSessions} of ${t.sessions}`} />
        {t.expenses > 0 && (
          <>
            <Tile label="Expenses" value={moneyRound(t.expenses)} note={`${withExpenses} sessions · avg ${moneyRound(t.expenses / withExpenses)}`} />
            <Tile label="Net after expenses" value={signed(t.result - t.expenses, true)} toneClass={tone(t.result - t.expenses)} note="poker result minus expenses" />
          </>
        )}
        <Tile label="Best session" value={signed(t.best, true)} toneClass={tone(t.best)} />
        <Tile label="Worst session" value={signed(t.worst, true)} toneClass={tone(t.worst)} />
        <Tile
          label="Max downswing"
          value={dd.max ? `−${moneyRound(dd.max)}` : '–'}
          note={dd.peakAt && dd.troughAt ? `${date(dd.peakAt)} → ${date(dd.troughAt)}${dd.recoveredAt ? '' : ' · not recovered'}` : undefined}
        />
      </div>
      {months.length > 1 && (
        <div className="card">
          <h2>By month</h2>
          <BarChart
            label="Result by month"
            diverging
            bars={months.map((m) => ({ key: m.key, label: monthLabel(m.key, false), title: monthLabel(m.key), v: m.v }))}
            format={(v) => signed(v, true)}
          />
        </div>
      )}
      <WeekdayCard ss={ss} />
    </>
  );
}

function WeekdayCard({ ss }: { ss: Session[] }) {
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const groups = groupBy(ss, (s) => weekday(s.startedAt));
  const byDay = order.map((d) => groups.find((g) => g.key === d)).filter((g): g is Group => !!g);
  if (byDay.length < 2) return null;
  return (
    <div className="card">
      <h2>By start day</h2>
      <BarChart
        label="Result by weekday"
        diverging
        height={150}
        bars={byDay.map((g) => ({ key: g.key, label: g.key, v: g.result }))}
        format={(v) => signed(v, true)}
        detail={(b) => {
          const g = byDay.find((x) => x.key === b.key)!;
          return `${g.sessions} sessions · ${hoursShort(g.hours)}`;
        }}
      />
    </div>
  );
}

function Cash({ ss, venueById }: { ss: CashSession[]; venueById: Map<number, Venue> }) {
  if (!ss.length) return <div className="card empty">No cash sessions in this selection.</div>;
  const t = totals(ss);
  const est = hourlyEstimate(ss);
  const bbh = bbPerHour(ss);
  return (
    <>
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Per hour" value={signed(t.perHour, true)} toneClass={tone(t.perHour)} />
        <Tile label="Big blinds / hour" value={bbh !== undefined ? (bbh > 0 ? '+' : '') + number(bbh) : '–'} toneClass={tone(bbh)} />
        <Tile label="Net" value={signed(t.result, true)} toneClass={tone(t.result)} />
        <Tile label="Hours" value={hoursShort(t.hours)} note={`${t.sessions} sessions · avg ${hoursShort(t.hours / t.sessions)}`} />
      </div>
      {est && <ConfidenceCard est={est} />}
      <GroupCard title="By stake" groups={groupBy(ss, (s) => `${s.game} ${stakeLabel(s as CashSession)}`)} mode="hourly" />
      <GroupCard title="By venue" groups={groupBy(ss, (s) => (s.venueId ? venueById.get(s.venueId)?.name ?? '?' : 'No venue'))} mode="hourly" />
      <GroupCard title="By session length" groups={lengthGroups(ss)} mode="hourly" keepOrder />
    </>
  );
}

function lengthGroups(ss: Session[]): Group[] {
  const bucket = (h: number) => (h < 3 ? '< 3 h' : h < 5 ? '3–5 h' : h < 8 ? '5–8 h' : '8 h +');
  const order = ['< 3 h', '3–5 h', '5–8 h', '8 h +'];
  return groupBy(ss, (s) => bucket(hoursPlayed(s))).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function ConfidenceCard({ est }: { est: NonNullable<ReturnType<typeof hourlyEstimate>> }) {
  const lo = Math.min(est.low, 0);
  const hi = Math.max(est.high, 0);
  const span = hi - lo || 1;
  const pos = (v: number) => `${((v - lo) / span) * 100}%`;
  const margin = (est.high - est.low) / 2;
  // Hours needed to get the ±margin down to ±5 €/h at the same volatility.
  const target = 5;
  const need = (1.96 * est.sdPerHour / target) ** 2;
  return (
    <div className="card">
      <h2>How sure is your hourly?</h2>
      <div className="ci-bar" aria-hidden="true">
        <div className="track" />
        <div className="range" style={{ left: pos(est.low), width: `calc(${pos(est.high)} - ${pos(est.low)})` }} />
        <div className="zero" style={{ left: pos(0) }} />
        <div className="dot" style={{ left: pos(est.rate) }} />
      </div>
      <div style={{ position: 'relative', height: 16, fontSize: 12, color: 'var(--muted)' }}>
        <span style={{ position: 'absolute', left: pos(est.low), transform: `translateX(${est.low <= lo ? 0 : -50}%)`, whiteSpace: 'nowrap' }}>{signed(est.low, true)}/h</span>
        <span style={{ position: 'absolute', left: pos(est.high), transform: `translateX(${est.high >= hi ? -100 : -50}%)`, whiteSpace: 'nowrap' }}>{signed(est.high, true)}/h</span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '10px 0 0' }}>
        Over {hoursShort(est.hours)} you made <strong>{signed(est.rate, true)}/h</strong>. With your swings (σ ≈ {moneyRound(est.sdPerHour)} per √hour), your true
        rate is 95% likely to be between <strong>{signed(est.low, true)}</strong> and <strong>{signed(est.high, true)}</strong> per hour (±{moneyRound(margin)}).{' '}
        {est.low > 0
          ? 'That range is above zero: you are very likely a winning player in this game.'
          : est.high < 0
            ? 'That range is below zero: on this sample you are very likely losing in this game.'
            : `The range still includes zero, so the sample can’t yet tell a winner from a loser.`}{' '}
        {need > est.hours && `Narrowing it to ±${target} €/h takes about ${number(Math.round(need / 10) * 10)} hours.`}
      </p>
    </div>
  );
}

function GroupCard({ title, groups, mode, keepOrder }: { title: string; groups: Group[]; mode: 'hourly' | 'roi'; keepOrder?: boolean }) {
  if (groups.length < 2 && !keepOrder) return null;
  if (!groups.length) return null;
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              <th className="r">#</th>
              <th className="r">{mode === 'hourly' ? 'Hours' : 'Invested'}</th>
              <th className="r">Result</th>
              <th className="r">{mode === 'hourly' ? '€/h' : 'ROI'}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <td style={{ whiteSpace: 'normal' }}>{g.key}</td>
                <td className="r">{g.sessions}</td>
                <td className="r">{mode === 'hourly' ? number(Math.round(g.hours * 10) / 10) : moneyRound(g.invested)}</td>
                <td className={`r ${tone(g.result)}`}>{signed(g.result, true)}</td>
                <td className={`r ${tone(g.result)}`}>{mode === 'hourly' ? signed(g.perHour, true) : signedPercent(g.roi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tournaments({ ts, venueById }: { ts: TournamentSession[]; venueById: Map<number, Venue> }) {
  if (!ts.length) return <div className="card empty">No tournaments in this selection.</div>;
  const st = tournamentStats(ts);
  const bands = BUY_IN_BANDS.map((b) => b.label)
    .map((label) => groupBy(ts.filter((t) => buyInBand(t) === label), () => label)[0])
    .filter((g): g is Group => !!g);
  const hist = finishHistogram(ts);
  const withFinish = hist.reduce((a, b) => a + b, 0);
  const recentCashes = ts.filter((t) => t.prize > 0).sort((a, b) => b.prize * b.fxToEur - a.prize * a.fxToEur).slice(0, 5);
  return (
    <>
      <div className="card">
        <div className="hero-label">ROI</div>
        <div className={`hero ${tone(st.roi)}`}>{signedPercent(st.roi)}</div>
        <div className="hint">
          {signed(st.result, true)} on {moneyRound(st.invested)} invested · {st.count} tournaments, {st.entries} entries
        </div>
      </div>
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="In the money" value={percent(st.itm)} note={`${st.cashes} cashes`} />
        <Tile label="Final tables" value={String(st.finalTables)} note={st.wins ? `${st.wins} ${st.wins === 1 ? 'win' : 'wins'}` : `top 9 finishes`} />
        <Tile label="Avg finish" value={st.avgFinishPct !== undefined ? `Top ${percent(st.avgFinishPct)}` : '–'} note="lower is better; 50% = average" />
        <Tile label="Biggest cash" value={moneyRound(st.biggestCash)} />
        <Tile label="Avg buy-in" value={moneyRound(st.avgBuyIn)} note={`re-entry rate ${number(Math.round((st.entries / st.count) * 100) / 100)}×${st.rebuys ? ` · ${st.rebuys} rebuys` : ''}`} />
        <Tile label="Bounties won" value={moneyRound(st.bounties)} />
      </div>
      {bands.length > 0 && (
        <div className="card">
          <h2>ROI by buy-in</h2>
          <BarChart
            label="ROI by buy-in band"
            diverging
            unit="%"
            height={160}
            bars={bands.map((g) => ({ key: g.key, label: g.key, v: Math.round((g.roi ?? 0) * 1000) / 10 }))}
            format={(v) => `${v > 0 ? '+' : ''}${number(v)} %`}
            detail={(b) => {
              const g = bands.find((x) => x.key === b.key)!;
              return `${g.sessions} played · ${signed(g.result, true)}`;
            }}
          />
          <GroupTable groups={bands} />
        </div>
      )}
      {withFinish >= 3 && (
        <div className="card">
          <h2>
            Where you finish <span className="sub">· {withFinish} with finish recorded</span>
          </h2>
          <BarChart
            label="Finish position histogram"
            unit=""
            height={150}
            color="var(--series-2)"
            bars={hist.map((n, i) => ({ key: String(i), label: i % 2 === 0 ? `${i * 10}%` : '', title: `Top ${i * 10}–${(i + 1) * 10}% of field`, v: n }))}
            format={(v) => `${v} tournaments`}
          />
          <p className="hint" style={{ margin: '6px 0 0' }}>Left = deep runs. A winning player’s bars lean left of the middle.</p>
        </div>
      )}
      <GroupCard title="By venue" groups={groupBy(ts, (s) => (s.venueId ? venueById.get(s.venueId)?.name ?? '?' : 'No venue'))} mode="roi" />
      <GroupCard title="By format" groups={groupBy(ts.filter((t) => t.formats.length), (s) => (s as TournamentSession).formats.slice().sort().join(' + '))} mode="roi" />
      {recentCashes.length > 0 && (
        <div className="card">
          <h2>Biggest cashes</h2>
          <ul className="list">
            {recentCashes.map((t) => (
              <li key={t.id}>
                <a className="item" href={`#/session/${t.id}`}>
                  <span className="main">
                    <div className="title">{t.eventName || 'Tournament'}</div>
                    <div className="meta">
                      {date(t.startedAt)} · {t.finish ? `${t.finish}${t.fieldSize ? `/${t.fieldSize}` : ''}` : 'cashed'}
                    </div>
                  </span>
                  <span className="amt">{money(t.prize, t.currency)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function GroupTable({ groups }: { groups: Group[] }) {
  return (
    <div className="table-wrap" style={{ marginTop: 8 }}>
      <table>
        <thead>
          <tr>
            <th>Buy-in</th>
            <th className="r">#</th>
            <th className="r">Invested</th>
            <th className="r">Result</th>
            <th className="r">ROI</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key}>
              <td>{g.key}</td>
              <td className="r">{g.sessions}</td>
              <td className="r">{moneyRound(g.invested)}</td>
              <td className={`r ${tone(g.result)}`}>{signed(g.result, true)}</td>
              <td className={`r ${tone(g.result)}`}>{signedPercent(g.roi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Venues({ ss, venueById }: { ss: Session[]; venueById: Map<number, Venue> }) {
  const byVenue = groupBy(ss, (s) => (s.venueId ? venueById.get(s.venueId)?.name ?? '?' : 'No venue'));
  const byCountry = groupBy(ss, (s) => (s.venueId ? venueById.get(s.venueId)?.country || '?' : 'Unknown'));
  return (
    <>
      <GroupCard title="By venue" groups={byVenue} mode="hourly" keepOrder />
      <GroupCard title="By country" groups={byCountry} mode="hourly" keepOrder />
    </>
  );
}
