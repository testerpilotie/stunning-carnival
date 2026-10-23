import type { CashSession, TournamentSession } from '../src/db/schema';

export const H = 3_600_000;
export const T0 = new Date('2026-01-10T18:00:00').getTime();

export function cash(p: Partial<CashSession> = {}): CashSession {
  return {
    kind: 'cash',
    status: 'done',
    startedAt: T0,
    endedAt: T0 + 4 * H,
    breaks: [],
    game: 'NLH',
    currency: 'EUR',
    fxToEur: 1,
    tags: [],
    notes: '',
    stackChecks: [],
    expenses: 0,
    sb: 1,
    bb: 2,
    buyIns: [{ at: T0, amount: 200 }],
    cashOut: 200,
    ...p,
  };
}

export function mtt(p: Partial<TournamentSession> = {}): TournamentSession {
  return {
    kind: 'tournament',
    status: 'done',
    startedAt: T0,
    endedAt: T0 + 6 * H,
    breaks: [],
    game: 'NLH',
    currency: 'EUR',
    fxToEur: 1,
    tags: [],
    notes: '',
    stackChecks: [],
    expenses: 0,
    eventName: 'Weekly',
    buyIn: 90,
    fee: 10,
    entries: 1,
    addOns: [],
    bountiesWon: 0,
    prize: 0,
    formats: [],
    ...p,
  };
}
