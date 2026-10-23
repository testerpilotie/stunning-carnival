import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_SETTINGS, type Session, type Settings, type Transaction, type Venue } from './schema';

export class FeltDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  venues!: EntityTable<Venue, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'felt') {
    super(name);
    this.version(1).stores({
      sessions: '++id, kind, status, startedAt, venueId',
      venues: '++id, name',
      transactions: '++id, at',
      settings: 'id',
    });
  }
}

export const db = new FeltDB();

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'settings' });
}

/** Asks the browser not to evict our IndexedDB under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
