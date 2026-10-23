import { useEffect, useState } from 'react';
import { db } from '../db/db';
import type { CashSession, Kind, Session, TournamentSession } from '../db/schema';
import { TOURNAMENT_FORMATS } from '../db/schema';
import { createSession, deleteSession, lastOfKind, saveSession } from '../lib/actions';
import { cashBuyInTotal, hoursPlayed, resultEur, resultLocal, sum } from '../lib/calc';
import { useData } from '../lib/data';
import { duration, fromLocalInput, money, signed, toLocalInput, tone } from '../lib/format';
import { back, go } from '../lib/router';
import { CurrencyFields } from '../components/CurrencyFields';
import { VenuePicker } from '../components/VenuePicker';
import { IntField, MoneyField, Top } from '../components/ui';

const H = 3_600_000;

function blank(kind: Kind): Session {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  const start = end.getTime() - 4 * H;
  const base = {
    status: 'done' as const,
    startedAt: start,
    endedAt: end.getTime(),
    breaks: [],
    game: 'NLH',
    currency: 'EUR',
    fxToEur: 1,
    tags: [],
    notes: '',
    stackChecks: [],
    expenses: 0,
  };
  return kind === 'cash'
    ? { ...base, kind: 'cash', sb: 1, bb: 2, buyIns: [{ at: start, amount: 200 }], cashOut: 0 }
    : { ...base, kind: 'tournament', eventName: '', buyIn: 0, fee: 0, entries: 1, addOns: [], bountiesWon: 0, prize: 0, formats: [] };
}

const breakMinutes = (s: Session) => Math.round(sum(s.breaks.map((b) => ((b.to ?? s.endedAt ?? Date.now()) - b.from) / 60_000)));

/** Full edit form; also used to add a past session (id undefined). */
export function SessionEdit({ id, kind }: { id?: number; kind?: Kind }) {
  const { venues } = useData();
  const [s, setS] = useState<Session>();
  const [breakMin, setBreakMin] = useState<number | undefined>(0);
  const [tagText, setTagText] = useState('');

  useEffect(() => {
    (async () => {
      let x: Session | undefined;
      if (id !== undefined) x = await db.sessions.get(id);
      else if (kind) {
        x = blank(kind);
        const last = await lastOfKind(kind);
        if (last) {
          // Carry over the setup of the previous session; results start empty.
          x = { ...x, venueId: last.venueId, game: last.game, currency: last.currency, fxToEur: last.fxToEur } as Session;
          if (x.kind === 'cash' && last.kind === 'cash') Object.assign(x, { sb: last.sb, bb: last.bb, buyIns: [{ at: x.startedAt, amount: last.buyIns[0]?.amount ?? 200 }] });
          if (x.kind === 'tournament' && last.kind === 'tournament') Object.assign(x, { eventName: last.eventName, buyIn: last.buyIn, fee: last.fee, formats: last.formats });
        }
      }
      if (x) {
        setS(x);
        setBreakMin(breakMinutes(x));
        setTagText(x.tags.join(', '));
      }
    })();
  }, [id, kind]);

  if (!s) return null;
  const set = (p: Partial<CashSession> | Partial<TournamentSession>) => setS({ ...s, ...p } as Session);
  const isNew = id === undefined;
  const live = s.status === 'live';

  const prepared = (): Session => {
    const out = { ...s, tags: tagText.split(',').map((t) => t.trim()).filter(Boolean) } as Session;
    if (out.status === 'done' && breakMin !== breakMinutes(s)) {
      out.breaks = breakMin ? [{ from: out.startedAt, to: out.startedAt + breakMin * 60_000 }] : [];
    }
    return out;
  };
  const preview = prepared();
  const valid = (s.endedAt === undefined || s.endedAt > s.startedAt) && (s.currency === 'EUR' || s.fxToEur > 0);

  const save = async () => {
    if (!valid) return;
    if (isNew) {
      await createSession(preview);
      go('/history', true);
    } else {
      await saveSession(preview);
      back('/history');
    }
  };

  return (
    <>
      <Top title={isNew ? (s.kind === 'cash' ? 'Add cash game' : 'Add tournament') : 'Edit session'} backTo="/history" />
      {!live && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="hero-label">Result</div>
          <div className={`hero ${tone(resultEur(preview))}`} style={{ fontSize: 36 }}>
            {signed(resultEur(preview))}
          </div>
          <div className="hint">
            {duration(hoursPlayed(preview))} played
            {s.currency !== 'EUR' && ` · ${money(resultLocal(preview), s.currency)}`}
          </div>
        </div>
      )}
      <div className="card">
        <VenuePicker venues={venues} value={s.venueId} onChange={(v) => set({ venueId: v?.id })} />
        <label className="field">
          <span>Game</span>
          <input value={s.game} onChange={(e) => set({ game: e.target.value })} list="games" />
          <datalist id="games">
            {['NLH', 'PLO', 'PLO5', 'Mixed'].map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <div className="grid2">
          <label className="field">
            <span>Start</span>
            <input type="datetime-local" value={toLocalInput(s.startedAt)} onChange={(e) => e.target.value && set({ startedAt: fromLocalInput(e.target.value) })} />
          </label>
          {!live && (
            <label className="field">
              <span>End</span>
              <input type="datetime-local" value={toLocalInput(s.endedAt ?? Date.now())} onChange={(e) => e.target.value && set({ endedAt: fromLocalInput(e.target.value) })} />
            </label>
          )}
        </div>
        {!live && <IntField label="Breaks (minutes)" value={breakMin} onChange={setBreakMin} />}
        {s.endedAt !== undefined && s.endedAt <= s.startedAt && <p className="hint neg">End must be after start.</p>}
      </div>

      {s.kind === 'cash' ? (
        <div className="card">
          <div className="grid2">
            <MoneyField label="Small blind" value={s.sb} onChange={(v) => set({ sb: v ?? 0 })} currency={s.currency} />
            <MoneyField label="Big blind" value={s.bb} onChange={(v) => set({ bb: v ?? 0 })} currency={s.currency} />
          </div>
          <MoneyField
            label="Total buy-in"
            value={cashBuyInTotal(s)}
            hint={s.buyIns.length > 1 ? `${s.buyIns.length} buy-ins logged; editing replaces them with one total.` : undefined}
            onChange={(v) => set({ buyIns: [{ at: s.startedAt, amount: v ?? 0 }] })}
            currency={s.currency}
          />
          {!live && <MoneyField label="Cash out" value={s.cashOut} onChange={(v) => set({ cashOut: v ?? 0 })} currency={s.currency} />}
        </div>
      ) : (
        <div className="card">
          <label className="field">
            <span>Event</span>
            <input value={s.eventName} onChange={(e) => set({ eventName: e.target.value })} />
          </label>
          <div className="grid2">
            <MoneyField label="Buy-in" value={s.buyIn} onChange={(v) => set({ buyIn: v ?? 0 })} currency={s.currency} />
            <MoneyField label="Fee" value={s.fee} onChange={(v) => set({ fee: v ?? 0 })} currency={s.currency} />
            <IntField label="Entries" value={s.entries} onChange={(v) => set({ entries: Math.max(1, v ?? 1) })} hint="1 + re-entries" />
            <MoneyField
              label="Add-ons total"
              value={sum(s.addOns.map((a) => a.amount))}
              onChange={(v) => set({ addOns: v ? [{ at: s.startedAt, amount: v }] : [] })}
              currency={s.currency}
            />
          </div>
          {!live && (
            <>
              <div className="grid2">
                <MoneyField label="Prize" value={s.prize} onChange={(v) => set({ prize: v ?? 0 })} currency={s.currency} />
                <MoneyField label="Bounties won" value={s.bountiesWon} onChange={(v) => set({ bountiesWon: v ?? 0 })} currency={s.currency} />
                <IntField label="Finished" value={s.finish} onChange={(v) => set({ finish: v })} />
                <IntField label="Field size" value={s.fieldSize} onChange={(v) => set({ fieldSize: v })} />
              </div>
            </>
          )}
          <div className="grid2">
            <IntField label="Starting stack" value={s.startingStack} onChange={(v) => set({ startingStack: v })} />
            <MoneyField label="Guarantee" value={s.guarantee} onChange={(v) => set({ guarantee: v })} currency={s.currency} />
          </div>
          <div className="field">
            <span>Format</span>
            <div className="chips">
              {TOURNAMENT_FORMATS.map((f) => (
                <button
                  type="button"
                  key={f}
                  className="chip"
                  aria-pressed={s.formats.includes(f)}
                  onClick={() => set({ formats: s.formats.includes(f) ? s.formats.filter((x) => x !== f) : [...s.formats, f] })}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <CurrencyFields currency={s.currency} fx={s.fxToEur} onChange={(c, r) => set({ currency: c, fxToEur: r })} />
        <MoneyField label="Expenses (travel, food, hotel)" value={s.expenses} onChange={(v) => set({ expenses: v ?? 0 })} currency={s.currency} hint="Kept out of the poker result; shown separately in stats." />
        <label className="field">
          <span>Tags</span>
          <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="trip, tilted, good table" />
          <span className="hint">Comma separated. Filter by tag in Stats.</span>
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea value={s.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </div>

      <button className="btn primary big block" disabled={!valid} onClick={save}>
        {isNew ? 'Add session' : 'Save'}
      </button>
      {!isNew && (
        <button
          className="btn danger block"
          style={{ marginTop: 12 }}
          onClick={async () => {
            if (!confirm('Delete this session? This cannot be undone.')) return;
            await deleteSession(s.id!);
            go('/history', true);
          }}
        >
          Delete session
        </button>
      )}
    </>
  );
}
