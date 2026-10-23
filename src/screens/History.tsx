import { useState } from 'react';
import type { Kind } from '../db/schema';
import { resultEur, sessionTime, sum } from '../lib/calc';
import { useData } from '../lib/data';
import { monthLabel, signed, tone } from '../lib/format';
import { monthKey } from '../lib/stats';
import { SessionRow } from '../components/SessionRow';
import { Seg, Sheet, Top } from '../components/ui';

export function History() {
  const { sessions, venueById, loaded } = useData();
  const [kind, setKind] = useState<'all' | Kind>('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  if (!loaded) return null;

  const needle = q.trim().toLowerCase();
  const list = sessions
    .filter((s) => kind === 'all' || s.kind === kind)
    .filter((s) => {
      if (!needle) return true;
      const v = s.venueId ? venueById.get(s.venueId) : undefined;
      const hay = [s.game, s.notes, s.tags.join(' '), v?.name, v?.city, v?.country, s.kind === 'tournament' ? s.eventName : ''].join(' ').toLowerCase();
      return hay.includes(needle);
    })
    .sort((a, b) => sessionTime(b) - sessionTime(a));

  const groups = new Map<string, typeof list>();
  for (const s of list) {
    const k = monthKey(sessionTime(s));
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  return (
    <>
      <Top
        title="History"
        right={
          <button className="btn ghost" style={{ minHeight: 40, padding: 0 }} onClick={() => setAdding(true)}>
            + Add
          </button>
        }
      />
      <Seg
        value={kind}
        onChange={setKind}
        options={[
          { value: 'all', label: 'All' },
          { value: 'cash', label: 'Cash' },
          { value: 'tournament', label: 'Tournaments' },
        ]}
      />
      <label className="field" style={{ marginTop: 10 }}>
        <input type="search" placeholder="Search venue, event, notes, tags" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {list.length === 0 && <div className="empty">Nothing here yet.</div>}
      {[...groups.entries()].map(([k, ss]) => {
        const total = sum(ss.filter((s) => s.status === 'done').map(resultEur));
        return (
          <section key={k}>
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{monthLabel(k)}</span>
              <span className={tone(total)} style={{ textTransform: 'none' }}>
                {signed(total, true)}
              </span>
            </div>
            <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              <ul className="list">
                {ss.map((s) => (
                  <SessionRow key={s.id} s={s} venueById={venueById} />
                ))}
              </ul>
            </div>
          </section>
        );
      })}
      {adding && (
        <Sheet title="Add a past session" onClose={() => setAdding(false)}>
          <div className="grid2">
            <a className="btn big" href="#/add/cash">
              Cash game
            </a>
            <a className="btn big" href="#/add/tournament">
              Tournament
            </a>
          </div>
        </Sheet>
      )}
    </>
  );
}
