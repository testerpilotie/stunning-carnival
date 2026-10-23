import { db, getSettings, updateSettings } from '../db/db';
import type { CashSession, MoneyEvent, Session, TournamentSession } from '../db/schema';

async function mutate(id: number, fn: (s: Session) => void): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id);
    if (!s) return;
    fn(s);
    await db.sessions.put(s);
  });
}

export async function rememberFx(currency: string, rate: number) {
  if (currency === 'EUR' || !(rate > 0)) return;
  const s = await getSettings();
  await updateSettings({ fxMemory: { ...s.fxMemory, [currency]: rate } });
}

export async function createSession(s: Session): Promise<number> {
  await rememberFx(s.currency, s.fxToEur);
  return (await db.sessions.add(s)) as number;
}

export async function saveSession(s: Session): Promise<void> {
  await rememberFx(s.currency, s.fxToEur);
  await db.sessions.put(s);
}

export const deleteSession = (id: number) => db.sessions.delete(id);

const ev = (amount: number): MoneyEvent => ({ at: Date.now(), amount });

export const addBuyIn = (id: number, amount: number) =>
  mutate(id, (s) => {
    if (s.kind === 'cash') s.buyIns.push(ev(amount));
  });

export const undoBuyIn = (id: number) =>
  mutate(id, (s) => {
    if (s.kind === 'cash' && s.buyIns.length > 1) s.buyIns.pop();
  });

export const addStackCheck = (id: number, amount: number) => mutate(id, (s) => void s.stackChecks.push(ev(amount)));

export const toggleBreak = (id: number) =>
  mutate(id, (s) => {
    const last = s.breaks[s.breaks.length - 1];
    if (last && last.to === undefined) last.to = Date.now();
    else s.breaks.push({ from: Date.now() });
  });

function closeBreak(s: Session, at: number) {
  const last = s.breaks[s.breaks.length - 1];
  if (last && last.to === undefined) last.to = at;
}

export const addReEntry = (id: number) =>
  mutate(id, (s) => {
    if (s.kind === 'tournament') s.entries += 1;
  });

export const undoReEntry = (id: number) =>
  mutate(id, (s) => {
    if (s.kind === 'tournament' && s.entries > 1) s.entries -= 1;
  });

export const addRebuy = (id: number, amount: number) =>
  mutate(id, (s) => {
    if (s.kind === 'tournament') (s.rebuys ??= []).push(ev(amount));
  });

export const undoRebuy = (id: number) =>
  mutate(id, (s) => {
    if (s.kind === 'tournament') s.rebuys?.pop();
  });

export const addAddOn = (id: number, amount: number) =>
  mutate(id, (s) => {
    if (s.kind === 'tournament') s.addOns.push(ev(amount));
  });

export const undoAddOn = (id: number) =>
  mutate(id, (s) => {
    if (s.kind === 'tournament') s.addOns.pop();
  });

export const addBounty = (id: number, amount: number) =>
  mutate(id, (s) => {
    if (s.kind === 'tournament') s.bountiesWon += amount;
  });

export const endCash = (id: number, cashOut: number, expenses?: number) =>
  mutate(id, (s) => {
    if (s.kind !== 'cash') return;
    const now = Date.now();
    closeBreak(s, now);
    s.cashOut = cashOut;
    if (expenses !== undefined) s.expenses = expenses;
    s.endedAt = now;
    s.status = 'done';
  });

export const endTournament = (id: number, r: { prize: number; finish?: number; fieldSize?: number; expenses?: number }) =>
  mutate(id, (s) => {
    if (s.kind !== 'tournament') return;
    const now = Date.now();
    closeBreak(s, now);
    if (r.expenses !== undefined) s.expenses = r.expenses;
    s.prize = r.prize;
    s.finish = r.finish;
    s.fieldSize = r.fieldSize ?? s.fieldSize;
    s.endedAt = now;
    s.status = 'done';
  });

/** The most recent session of a kind, used to prefill "same as last time". */
export async function lastOfKind<K extends Session['kind']>(kind: K) {
  const all = await db.sessions.where('kind').equals(kind).sortBy('startedAt');
  return all[all.length - 1] as (K extends 'cash' ? CashSession : TournamentSession) | undefined;
}
