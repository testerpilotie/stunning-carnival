import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_SETTINGS, type Session, type Settings, type Transaction, type Venue } from '../db/schema';
import { stakeLabel } from './calc';
import { money } from './format';

export interface Data {
  sessions: Session[];
  venues: Venue[];
  venueById: Map<number, Venue>;
  transactions: Transaction[];
  settings: Settings;
  loaded: boolean;
}

export function useData(): Data {
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').toArray(), []);
  const venues = useLiveQuery(() => db.venues.orderBy('name').toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.orderBy('at').toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  return {
    sessions: sessions ?? [],
    venues: venues ?? [],
    venueById: new Map((venues ?? []).map((v) => [v.id!, v])),
    transactions: transactions ?? [],
    settings: settings ?? DEFAULT_SETTINGS,
    loaded: sessions !== undefined && venues !== undefined,
  };
}

/** "NLH 1/2" or "Weekly Deepstack · 100 €". */
export function headline(s: Session): string {
  if (s.kind === 'cash') return `${s.game} ${stakeLabel(s)}`;
  return s.eventName || `${s.game} tournament`;
}

export function subline(s: Session, venueById: Map<number, Venue>): string {
  const venue = s.venueId ? venueById.get(s.venueId)?.name : undefined;
  const parts = [venue];
  if (s.kind === 'tournament') parts.push(money(s.buyIn + s.fee, s.currency));
  return parts.filter(Boolean).join(' · ');
}

/** Online FX lookup (ECB rates via frankfurter). Undefined when offline or on error. */
export async function fetchFx(currency: string): Promise<number | undefined> {
  if (currency === 'EUR') return 1;
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=EUR`);
    if (!r.ok) return undefined;
    const j = await r.json();
    const v = j?.rates?.EUR;
    return typeof v === 'number' ? Math.round(v * 10000) / 10000 : undefined;
  } catch {
    return undefined;
  }
}
