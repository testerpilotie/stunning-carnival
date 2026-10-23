import { db, getSettings, updateSettings } from './db';
import type { Session, Settings, Transaction, Venue } from './schema';
import { hoursPlayed, invested, resultEur, resultLocal, returned, stakeLabel } from '../lib/calc';
import { date, time } from '../lib/format';

export interface Backup {
  app: 'felt';
  version: 1;
  exportedAt: number;
  sessions: Session[];
  venues: Venue[];
  transactions: Transaction[];
  settings: Settings;
}

export async function buildBackup(): Promise<Backup> {
  return {
    app: 'felt',
    version: 1,
    exportedAt: Date.now(),
    sessions: await db.sessions.toArray(),
    venues: await db.venues.toArray(),
    transactions: await db.transactions.toArray(),
    settings: await getSettings(),
  };
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Hands the file to the OS share sheet where possible (iOS: Save to Files / iCloud Drive),
 * otherwise triggers a normal download.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

export async function saveBackup(): Promise<boolean> {
  const data = await buildBackup();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const res = await shareOrDownload(blob, `felt-backup-${stamp()}.json`);
  if (res === 'cancelled') return false;
  await updateSettings({ lastBackupAt: Date.now() });
  return true;
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text);
  if (data?.app !== 'felt' || !Array.isArray(data.sessions)) throw new Error('This is not a Felt backup file.');
  return data as Backup;
}

/** Replaces everything on this device with the backup's contents. */
export async function restoreBackup(b: Backup): Promise<void> {
  await db.transaction('rw', [db.sessions, db.venues, db.transactions, db.settings], async () => {
    await Promise.all([db.sessions.clear(), db.venues.clear(), db.transactions.clear(), db.settings.clear()]);
    await db.sessions.bulkPut(b.sessions);
    await db.venues.bulkPut(b.venues ?? []);
    await db.transactions.bulkPut(b.transactions ?? []);
    if (b.settings) await db.settings.put({ ...b.settings, id: 'settings' });
  });
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Semicolon-separated with comma decimals, so it opens cleanly in a Finnish-locale spreadsheet. */
export async function exportCsv(): Promise<void> {
  const sessions = (await db.sessions.toArray()).filter((s) => s.status === 'done').sort((a, b) => a.startedAt - b.startedAt);
  const venues = new Map((await db.venues.toArray()).map((v) => [v.id, v]));
  const dec = (n: number | undefined) => (n === undefined ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
  const head = [
    'Date', 'Start', 'End', 'Type', 'Venue', 'City', 'Country', 'Game', 'Stakes / Event', 'Currency', 'FX to EUR',
    'Hours', 'Invested', 'Returned', 'Result', 'Result EUR', 'Entries', 'Finish', 'Field', 'Expenses', 'Tags', 'Notes',
  ];
  const rows = sessions.map((s) => {
    const v = s.venueId ? venues.get(s.venueId) : undefined;
    return [
      date(s.startedAt), time(s.startedAt), s.endedAt ? time(s.endedAt) : '', s.kind, v?.name, v?.city, v?.country, s.game,
      s.kind === 'cash' ? stakeLabel(s) : s.eventName, s.currency, dec(s.fxToEur), dec(hoursPlayed(s)), dec(invested(s)),
      dec(returned(s)), dec(resultLocal(s)), dec(resultEur(s)), s.kind === 'tournament' ? s.entries : '',
      s.kind === 'tournament' ? s.finish : '', s.kind === 'tournament' ? s.fieldSize : '', dec(s.expenses), s.tags.join(', '), s.notes,
    ];
  });
  const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
  await shareOrDownload(new Blob([csv], { type: 'text/csv' }), `felt-sessions-${stamp()}.csv`);
}
