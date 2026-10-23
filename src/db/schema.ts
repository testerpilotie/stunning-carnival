export type Kind = 'cash' | 'tournament';
export type Status = 'live' | 'done';

/** A point-in-time money event, amount in the session's own currency. */
export interface MoneyEvent {
  at: number;
  amount: number;
}

export interface Break {
  from: number;
  to?: number;
}

interface SessionBase {
  id?: number;
  kind: Kind;
  status: Status;
  startedAt: number;
  endedAt?: number;
  breaks: Break[];
  venueId?: number;
  game: string;
  /** ISO 4217 code of the money used at the table. */
  currency: string;
  /** Value of one unit of `currency` in EUR, fixed when the session is logged. */
  fxToEur: number;
  tags: string[];
  notes: string;
  stackChecks: MoneyEvent[];
  /** Travel, food, hotel: tracked apart from the poker result. */
  expenses: number;
}

export interface CashSession extends SessionBase {
  kind: 'cash';
  sb: number;
  bb: number;
  buyIns: MoneyEvent[];
  cashOut?: number;
}

export interface TournamentSession extends SessionBase {
  kind: 'tournament';
  eventName: string;
  /** Prize-pool part of one entry. */
  buyIn: number;
  /** Rake part of one entry. */
  fee: number;
  /** 1 + re-entries. Each entry costs buyIn + fee. */
  entries: number;
  /**
   * Rebuys within an entry (rebuy-format tournaments). The whole amount goes to the
   * prize pool, so no fee. Missing on sessions logged before rebuys were tracked.
   */
  rebuys?: MoneyEvent[];
  addOns: MoneyEvent[];
  bountiesWon: number;
  prize: number;
  fieldSize?: number;
  finish?: number;
  guarantee?: number;
  startingStack?: number;
  formats: string[];
}

export type Session = CashSession | TournamentSession;

export interface Venue {
  id?: number;
  name: string;
  city: string;
  country: string;
  defaultCurrency: string;
}

export interface Transaction {
  id?: number;
  at: number;
  type: 'deposit' | 'withdrawal';
  /** EUR. */
  amount: number;
  note: string;
}

export interface Settings {
  id: 'settings';
  startingBankroll: number;
  lastBackupAt?: number;
  theme: 'system' | 'light' | 'dark';
  games: string[];
  /** Last FX rate used per currency, so trips abroad prefill. */
  fxMemory: Record<string, number>;
}

export const DEFAULT_GAMES = ['NLH', 'PLO', 'PLO5', 'Mixed', 'Short Deck', 'Stud'];
export const TOURNAMENT_FORMATS = ['Freezeout', 'Re-entry', 'Rebuy', 'Turbo', 'Deepstack', 'Bounty', 'Satellite', 'Main event', 'Side event'];
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'SEK', 'NOK', 'DKK', 'CZK', 'PLN', 'HUF', 'CHF'];

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  startingBankroll: 0,
  theme: 'system',
  games: DEFAULT_GAMES,
  fxMemory: {},
};
