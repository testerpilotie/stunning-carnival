import { useEffect, useRef, useState } from 'react';
import { db, updateSettings } from '../db/db';
import { exportCsv, parseBackup, restoreBackup, saveBackup } from '../db/backup';
import type { Settings as S, Venue } from '../db/schema';
import { useData } from '../lib/data';
import { dateTime } from '../lib/format';
import { isStandalone } from '../components/Banners';
import { VenueSheet } from '../components/VenuePicker';
import { Seg, Top } from '../components/ui';

export function Settings() {
  const { settings, venues, sessions } = useData();
  const [venue, setVenue] = useState<Venue | 'new' | null>(null);
  const [newGame, setNewGame] = useState('');
  const [msg, setMsg] = useState('');
  const [persisted, setPersisted] = useState<boolean>();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => undefined);
  }, []);

  const onRestore = async (f: File) => {
    try {
      const b = parseBackup(await f.text());
      if (!confirm(`Replace everything on this device with the backup from ${dateTime(b.exportedAt)} (${b.sessions.length} sessions)?`)) return;
      await restoreBackup(b);
      setMsg(`Restored ${b.sessions.length} sessions.`);
    } catch (e) {
      setMsg((e as Error).message || 'Could not read that file.');
    }
  };

  return (
    <>
      <Top title="Settings" />
      <div className="section-title">Backup</div>
      <div className="card">
        <div className="kv">
          <span className="k">Last backup</span>
          <span className="v">{settings.lastBackupAt ? dateTime(settings.lastBackupAt) : 'Never'}</span>
        </div>
        <div className="kv">
          <span className="k">Sessions on this device</span>
          <span className="v">{sessions.length}</span>
        </div>
        <div className="kv">
          <span className="k">Storage protected</span>
          <span className="v">{persisted === undefined ? '–' : persisted ? 'Yes' : isStandalone() ? 'Not granted' : 'Install the app'}</span>
        </div>
        <div style={{ height: 12 }} />
        <button
          className="btn primary block"
          onClick={async () => {
            if (await saveBackup()) setMsg('Backup saved.');
          }}
        >
          Save backup (JSON)
        </button>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => file.current?.click()}>
            Restore…
          </button>
          <button className="btn" onClick={() => exportCsv()}>
            Export CSV
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onRestore(f);
            e.target.value = '';
          }}
        />
        {msg && <p className="hint" role="status">{msg}</p>}
        <p className="hint" style={{ marginBottom: 0 }}>
          Your data is stored only in this browser on this device. Save the backup to iCloud Drive or Google Drive; restoring on a new phone brings everything
          back. CSV uses semicolons and decimal commas for Finnish-locale Sheets/Excel.
        </p>
      </div>

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Venues</span>
        <button className="btn ghost" style={{ minHeight: 0, padding: 0, textTransform: 'none', letterSpacing: 0 }} onClick={() => setVenue('new')}>
          + Add
        </button>
      </div>
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {venues.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>
            Add the casinos and card rooms you play at.
          </div>
        ) : (
          <ul className="list">
            {venues.map((v) => {
              const used = sessions.filter((s) => s.venueId === v.id).length;
              return (
                <li key={v.id} className="item">
                  <button className="main" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, cursor: 'pointer' }} onClick={() => setVenue(v)}>
                    <div className="title">{v.name}</div>
                    <div className="meta">
                      {[v.city, v.country, v.defaultCurrency].filter(Boolean).join(' · ')} · {used} sessions
                    </div>
                  </button>
                  {used === 0 && (
                    <button className="btn ghost" aria-label={`Delete ${v.name}`} style={{ minHeight: 36, padding: '0 6px', color: 'var(--muted)' }} onClick={() => db.venues.delete(v.id!)}>
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="section-title">Games</div>
      <div className="card">
        <div className="chips" style={{ marginBottom: 12 }}>
          {settings.games.map((g) => (
            <button
              key={g}
              className="chip"
              title="Remove"
              onClick={() => settings.games.length > 1 && updateSettings({ games: settings.games.filter((x) => x !== g) })}
            >
              {g} ✕
            </button>
          ))}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const g = newGame.trim();
            if (g && !settings.games.includes(g)) updateSettings({ games: [...settings.games, g] });
            setNewGame('');
          }}
        >
          <label className="field" style={{ marginBottom: 0 }}>
            <input placeholder="Add a game, e.g. Big O" value={newGame} onChange={(e) => setNewGame(e.target.value)} />
          </label>
          <button className="btn" style={{ flex: 'none' }}>
            Add
          </button>
        </form>
      </div>

      <div className="section-title">Appearance</div>
      <div className="card">
        <Seg<S['theme']>
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </div>

      <div className="section-title">Install on your phone</div>
      <div className="card" style={{ fontSize: 14, color: 'var(--ink-2)' }}>
        <p style={{ marginTop: 0 }}>
          <strong>iPhone (Safari):</strong> Share button → “Add to Home Screen”. Open Felt from the home-screen icon from then on: Safari deletes data of
          websites not used for 7 days, but not of home-screen apps.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Android (Chrome):</strong> ⋮ menu → “Install app”. Works fully offline once installed.
        </p>
      </div>
      {venue && <VenueSheet venue={venue === 'new' ? undefined : venue} onClose={() => setVenue(null)} />}
    </>
  );
}
