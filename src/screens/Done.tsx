import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { expensesEur, hoursPlayed, investedEur, resultEur, resultLocal } from '../lib/calc';
import { headline, subline, useData } from '../lib/data';
import { duration, money, percent, signed, signedPercent, tone } from '../lib/format';
import { go } from '../lib/router';
import { BackupBanner, backupDue } from '../components/Banners';
import { Tile, Top } from '../components/ui';

export function Done({ id }: { id: number }) {
  const s = useLiveQuery(() => db.sessions.get(id), [id]);
  const { sessions, settings, venueById } = useData();
  if (!s) return null;
  const r = resultEur(s);
  const h = hoursPlayed(s);
  return (
    <>
      <Top title="Session done" />
      <div className="card" style={{ textAlign: 'center', padding: '28px 16px' }}>
        <div className="hero-label">
          {headline(s)} · {subline(s, venueById)}
        </div>
        <div className={`hero ${tone(r)}`} style={{ margin: '8px 0 4px' }}>
          {signed(r)}
        </div>
        {s.expenses > 0 && (
          <div className="hint">
            Expenses {money(expensesEur(s))} · after expenses <span className={tone(r - expensesEur(s))}>{signed(r - expensesEur(s))}</span>
          </div>
        )}
        {s.currency !== 'EUR' && <div className="hint">{signed(resultLocal(s)).replace('€', s.currency)} at {s.fxToEur} €/{s.currency}</div>}
      </div>
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Played" value={duration(h)} />
        {s.kind === 'cash' ? (
          <Tile label="Per hour" value={h >= 0.25 ? signed(r / h, true) : '–'} note={h < 0.25 ? 'too short to rate' : undefined} toneClass={h >= 0.25 ? tone(r) : ''} />
        ) : (
          <Tile label="ROI" value={signedPercent(r / investedEur(s))} toneClass={tone(r)} />
        )}
        {s.kind === 'tournament' && s.finish && (
          <Tile label="Finish" value={`${s.finish}${s.fieldSize ? ` / ${s.fieldSize}` : ''}`} note={s.fieldSize ? `Top ${percent(s.finish / s.fieldSize)} of the field` : undefined} />
        )}
        {s.kind === 'tournament' && <Tile label="Invested" value={money(investedEur(s))} note={[`${s.entries} ${s.entries === 1 ? 'entry' : 'entries'}`, s.rebuys?.length ? `${s.rebuys.length} ${s.rebuys.length === 1 ? 'rebuy' : 'rebuys'}` : '', s.addOns.length ? `${s.addOns.length} add-on${s.addOns.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')} />}
      </div>
      {backupDue(settings, sessions.length, 7) && <BackupBanner settings={settings} text="Good moment for a backup — one tap, saves to Files / Drive." />}
      <div className="row">
        <a className="btn" href={`#/session/${id}`}>
          Edit details
        </a>
        <button className="btn primary" onClick={() => go('/', true)}>
          Done
        </button>
      </div>
    </>
  );
}
