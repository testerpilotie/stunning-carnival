import type { CashSession, Session, TournamentSession, Transaction } from '../db/schema';
import {
  entryCostEur,
  expensesEur,
  finishPercentile,
  hoursPlayed,
  investedEur,
  isItm,
  resultEur,
  sessionTime,
  stakeLabel,
  sum,
  toEur,
} from './calc';

export interface Totals {
  sessions: number;
  hours: number;
  result: number;
  expenses: number;
  perHour: number | undefined;
  winningSessions: number;
  best: number | undefined;
  worst: number | undefined;
}

export function totals(sessions: Session[]): Totals {
  const results = sessions.map(resultEur);
  const hours = sum(sessions.map((s) => hoursPlayed(s)));
  const result = sum(results);
  return {
    sessions: sessions.length,
    hours,
    result,
    expenses: sum(sessions.map(expensesEur)),
    perHour: hours > 0 ? result / hours : undefined,
    winningSessions: results.filter((r) => r > 0).length,
    best: results.length ? Math.max(...results) : undefined,
    worst: results.length ? Math.min(...results) : undefined,
  };
}

export interface Point {
  t: number;
  v: number;
}

/** Running sum of results, oldest first, with a zero point before the first session. */
export function cumulative(sessions: Session[]): Point[] {
  const sorted = [...sessions].sort((a, b) => sessionTime(a) - sessionTime(b));
  if (!sorted.length) return [];
  const pts: Point[] = [{ t: sorted[0].startedAt, v: 0 }];
  let acc = 0;
  for (const s of sorted) {
    acc += resultEur(s);
    pts.push({ t: sessionTime(s), v: acc });
  }
  return pts;
}

export interface Drawdown {
  /** Largest peak-to-trough fall, as a positive number. */
  max: number;
  peakAt?: number;
  troughAt?: number;
  /** When the series got back above the old peak, if it has. */
  recoveredAt?: number;
  /** How far below the all-time high the series is now. */
  current: number;
  /** Distance below the running peak at every point (≤ 0). */
  underwater: Point[];
}

export function drawdown(series: Point[]): Drawdown {
  let peak = -Infinity;
  let peakAt: number | undefined;
  let max = 0;
  let maxPeak = 0;
  let maxPeakAt: number | undefined;
  let troughAt: number | undefined;
  let recoveredAt: number | undefined;
  const underwater: Point[] = [];
  for (const p of series) {
    if (p.v > peak) {
      peak = p.v;
      peakAt = p.t;
    }
    if (troughAt !== undefined && recoveredAt === undefined && p.t > troughAt && p.v >= maxPeak) recoveredAt = p.t;
    const dd = peak - p.v;
    underwater.push({ t: p.t, v: -dd });
    if (dd > max) {
      max = dd;
      maxPeak = peak;
      maxPeakAt = peakAt;
      troughAt = p.t;
      recoveredAt = undefined;
    }
  }
  const last = series[series.length - 1];
  return { max, peakAt: maxPeakAt, troughAt, recoveredAt, current: last ? peak - last.v : 0, underwater };
}

export interface HourlyEstimate {
  rate: number;
  /** Standard deviation of results per hour of play. */
  sdPerHour: number;
  /** 95% confidence interval for the true hourly rate. */
  low: number;
  high: number;
  hours: number;
}

/**
 * Treats each session's result as Normal(rate·h, σ²·h): variance grows with time played.
 * rate is the pooled Σresult/Σhours, σ² is estimated from the per-session residuals,
 * and the standard error of the rate is σ/√Σh.
 */
export function hourlyEstimate(sessions: Session[]): HourlyEstimate | undefined {
  const rows = sessions.map((s) => ({ r: resultEur(s), h: hoursPlayed(s) })).filter((x) => x.h > 0.05);
  if (rows.length < 2) return undefined;
  const H = sum(rows.map((x) => x.h));
  const rate = sum(rows.map((x) => x.r)) / H;
  const variance = sum(rows.map((x) => (x.r - rate * x.h) ** 2 / x.h)) / (rows.length - 1);
  const sdPerHour = Math.sqrt(variance);
  const se = sdPerHour / Math.sqrt(H);
  return { rate, sdPerHour, low: rate - 1.96 * se, high: rate + 1.96 * se, hours: H };
}

/** Big blinds per hour, each session measured in its own big blind. */
export function bbPerHour(sessions: CashSession[]): number | undefined {
  const rows = sessions.filter((s) => s.bb > 0 && hoursPlayed(s) > 0);
  const hours = sum(rows.map((s) => hoursPlayed(s)));
  if (!hours) return undefined;
  return sum(rows.map((s) => resultEur(s) / toEur(s, s.bb))) / hours;
}

export interface TournamentStats {
  count: number;
  entries: number;
  rebuys: number;
  invested: number;
  result: number;
  roi: number | undefined;
  itm: number | undefined;
  cashes: number;
  finalTables: number;
  wins: number;
  avgFinishPct: number | undefined;
  biggestCash: number | undefined;
  bounties: number;
  avgBuyIn: number | undefined;
}

export const FINAL_TABLE_SIZE = 9;

export function tournamentStats(ts: TournamentSession[]): TournamentStats {
  const invested = sum(ts.map(investedEur));
  const result = sum(ts.map(resultEur));
  const cashes = ts.filter(isItm);
  const pcts = ts.map(finishPercentile).filter((x): x is number => x !== undefined);
  return {
    count: ts.length,
    entries: sum(ts.map((t) => t.entries)),
    rebuys: sum(ts.map((t) => t.rebuys?.length ?? 0)),
    invested,
    result,
    roi: invested > 0 ? result / invested : undefined,
    itm: ts.length ? cashes.length / ts.length : undefined,
    cashes: cashes.length,
    finalTables: ts.filter((t) => t.finish !== undefined && t.finish > 0 && t.finish <= FINAL_TABLE_SIZE).length,
    wins: ts.filter((t) => t.finish === 1).length,
    avgFinishPct: pcts.length ? sum(pcts) / pcts.length : undefined,
    biggestCash: cashes.length ? Math.max(...cashes.map((t) => toEur(t, t.prize))) : undefined,
    bounties: sum(ts.map((t) => toEur(t, t.bountiesWon))),
    avgBuyIn: ts.length ? sum(ts.map(entryCostEur)) / ts.length : undefined,
  };
}

export const BUY_IN_BANDS = [
  { label: '< 50 €', min: 0, max: 50 },
  { label: '50–149 €', min: 50, max: 150 },
  { label: '150–499 €', min: 150, max: 500 },
  { label: '500 €+', min: 500, max: Infinity },
] as const;

export function buyInBand(t: TournamentSession): string {
  const c = entryCostEur(t);
  return BUY_IN_BANDS.find((b) => c >= b.min && c < b.max)!.label;
}

/** Finish percentiles in ten buckets: 0 = top 10% of the field. */
export function finishHistogram(ts: TournamentSession[]): number[] {
  const bins = Array(10).fill(0);
  for (const t of ts) {
    const p = finishPercentile(t);
    if (p !== undefined) bins[Math.min(9, Math.floor(p * 10))]++;
  }
  return bins;
}

export interface Group {
  key: string;
  sessions: number;
  hours: number;
  result: number;
  invested: number;
  perHour: number | undefined;
  roi: number | undefined;
}

export function groupBy(sessions: Session[], keyOf: (s: Session) => string): Group[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const k = keyOf(s);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.entries()]
    .map(([key, ss]) => {
      const hours = sum(ss.map((s) => hoursPlayed(s)));
      const result = sum(ss.map(resultEur));
      const invested = sum(ss.map(investedEur));
      return {
        key,
        sessions: ss.length,
        hours,
        result,
        invested,
        perHour: hours > 0 ? result / hours : undefined,
        roi: invested > 0 ? result / invested : undefined,
      };
    })
    .sort((a, b) => b.result - a.result);
}

export const monthKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Result per calendar month, every month from first to last filled in (empty = 0). */
export function monthly(sessions: Session[]): { key: string; v: number }[] {
  if (!sessions.length) return [];
  const byMonth = new Map<string, number>();
  for (const s of sessions) {
    const k = monthKey(sessionTime(s));
    byMonth.set(k, (byMonth.get(k) ?? 0) + resultEur(s));
  }
  const keys = [...byMonth.keys()].sort();
  const out: { key: string; v: number }[] = [];
  let [y, m] = keys[0].split('-').map(Number);
  const [ly, lm] = keys[keys.length - 1].split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ key: k, v: byMonth.get(k) ?? 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Bankroll over time: starting amount, then every finished session and transaction in order. */
export function bankrollSeries(sessions: Session[], txs: Transaction[], start: number): Point[] {
  const events = [
    ...sessions.filter((s) => s.status === 'done').map((s) => ({ t: sessionTime(s), d: resultEur(s) })),
    ...txs.map((x) => ({ t: x.at, d: x.type === 'deposit' ? x.amount : -x.amount })),
  ].sort((a, b) => a.t - b.t);
  if (!events.length) return [];
  let acc = start;
  const pts: Point[] = [{ t: events[0].t - 1, v: start }];
  for (const e of events) {
    acc += e.d;
    pts.push({ t: e.t, v: acc });
  }
  return pts;
}

export function currentBankroll(sessions: Session[], txs: Transaction[], start: number): number {
  return (
    start +
    sum(sessions.filter((s) => s.status === 'done').map(resultEur)) +
    sum(txs.map((x) => (x.type === 'deposit' ? x.amount : -x.amount)))
  );
}

/** Median of the latest n values, used for "typical buy-in". */
export function recentMedian(values: number[], n = 10): number | undefined {
  const xs = values.slice(-n).sort((a, b) => a - b);
  if (!xs.length) return undefined;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export { stakeLabel };
