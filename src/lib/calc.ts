import type { CashSession, Session, TournamentSession } from '../db/schema';

const HOUR = 3_600_000;

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Playing time in hours, breaks excluded. A live session counts up to `now`. */
export function hoursPlayed(s: Session, now = Date.now()): number {
  const end = s.endedAt ?? now;
  const breakMs = sum(
    s.breaks.map((b) => {
      const from = Math.max(b.from, s.startedAt);
      const to = Math.min(b.to ?? end, end);
      return Math.max(0, to - from);
    }),
  );
  return Math.max(0, end - s.startedAt - breakMs) / HOUR;
}

export function onBreak(s: Session): boolean {
  const last = s.breaks[s.breaks.length - 1];
  return !!last && last.to === undefined;
}

export function cashBuyInTotal(s: CashSession): number {
  return sum(s.buyIns.map((b) => b.amount));
}

export const rebuyTotal = (s: TournamentSession) => sum((s.rebuys ?? []).map((r) => r.amount));
export const addOnTotal = (s: TournamentSession) => sum(s.addOns.map((a) => a.amount));

/** Total cost of a tournament in its own currency: every entry's buy-in + fee, plus rebuys and add-ons. */
export function tournamentCost(s: TournamentSession): number {
  return s.entries * (s.buyIn + s.fee) + rebuyTotal(s) + addOnTotal(s);
}

/** Money put at risk, in the session's own currency. */
export function invested(s: Session): number {
  return s.kind === 'cash' ? cashBuyInTotal(s) : tournamentCost(s);
}

/** Money taken off the table, in the session's own currency. */
export function returned(s: Session): number {
  return s.kind === 'cash' ? (s.cashOut ?? 0) : s.prize + s.bountiesWon;
}

/** Poker result in the session's own currency (expenses excluded). */
export function resultLocal(s: Session): number {
  return returned(s) - invested(s);
}

export const toEur = (s: Session, amount: number) => amount * s.fxToEur;

export const resultEur = (s: Session) => toEur(s, resultLocal(s));
export const investedEur = (s: Session) => toEur(s, invested(s));
export const expensesEur = (s: Session) => toEur(s, s.expenses);

/** Single buy-in cost of a tournament entry in EUR, used for buy-in bands. */
export const entryCostEur = (s: TournamentSession) => toEur(s, s.buyIn + s.fee);

export const isItm = (s: TournamentSession) => s.prize > 0;

/** 0 = won it, 1 = first out. Undefined when finish or field size is unknown. */
export function finishPercentile(s: TournamentSession): number | undefined {
  if (!s.finish || !s.fieldSize || s.fieldSize < 2) return undefined;
  return (Math.min(s.finish, s.fieldSize) - 1) / (s.fieldSize - 1);
}

export const stakeLabel = (s: CashSession) => `${fmtStake(s.sb)}/${fmtStake(s.bb)}`;
const fmtStake = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ','));

/** The time a session belongs to on charts: its end, or start if still live. */
export const sessionTime = (s: Session) => s.endedAt ?? s.startedAt;
