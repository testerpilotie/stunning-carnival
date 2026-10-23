import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { CashSession, Session, TournamentSession } from '../db/schema';
import {
  addAddOn,
  addBounty,
  addBuyIn,
  addReEntry,
  addStackCheck,
  endCash,
  endTournament,
  toggleBreak,
  undoBuyIn,
  undoReEntry,
} from '../lib/actions';
import { cashBuyInTotal, hoursPlayed, onBreak, tournamentCost } from '../lib/calc';
import { headline, useData } from '../lib/data';
import { clock, money, signed, time, tone } from '../lib/format';
import { go } from '../lib/router';
import { LineChart } from '../components/charts/LineChart';
import { AmountSheet, IntField, MoneyField, Sheet, Top, useNow } from '../components/ui';

type Dialog = null | 'rebuy' | 'stack' | 'cashout' | 'addon' | 'bounty' | 'bust' | 'cashed';

function useUndo() {
  const [toast, setToast] = useState<{ text: string; undo: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = (text: string, undo: () => void) => {
    clearTimeout(timer.current);
    setToast({ text, undo });
    timer.current = setTimeout(() => setToast(null), 5000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const el = toast && (
    <div className="banner" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom) + 84px)', zIndex: 30, maxWidth: 528, margin: '0 auto' }} role="status">
      <span className="grow">{toast.text}</span>
      <button
        className="btn"
        onClick={() => {
          toast.undo();
          setToast(null);
        }}
      >
        Undo
      </button>
    </div>
  );
  return { show, el };
}

export function Live({ id }: { id: number }) {
  const s = useLiveQuery(() => db.sessions.get(id), [id]);
  const { venueById } = useData();
  const now = useNow(1000);
  const [dialog, setDialog] = useState<Dialog>(null);
  const undo = useUndo();

  useEffect(() => {
    if (s?.status === 'done') go(`/done/${id}`, true);
  }, [s?.status, id]);

  if (!s || s.status === 'done') return null;
  const paused = onBreak(s);
  const venue = s.venueId ? venueById.get(s.venueId)?.name : undefined;
  const lastStack = s.stackChecks[s.stackChecks.length - 1]?.amount;
  const close = () => setDialog(null);

  return (
    <>
      <Top title="Live" backTo="/" right={<a className="btn ghost" style={{ minHeight: 40, padding: 0 }} href={`#/session/${id}`}>Edit</a>} />
      <div className="live-head">
        <div className={`live-pill${paused ? ' paused' : ''}`}>{paused ? 'ON BREAK' : 'LIVE'}</div>
        <div className="clock">{clock(hoursPlayed(s, now))}</div>
        <div className="what">
          {headline(s)}
          {venue ? ` · ${venue}` : ''} · since {time(s.startedAt)}
        </div>
      </div>

      {s.kind === 'cash' ? (
        <CashPanel s={s} lastStack={lastStack} setDialog={setDialog} onRebuy={() => {
          const amt = s.buyIns[s.buyIns.length - 1].amount;
          addBuyIn(id, amt);
          undo.show(`Rebuy ${money(amt, s.currency)} added`, () => undoBuyIn(id));
        }} />
      ) : (
        <TournamentPanel s={s} lastStack={lastStack} setDialog={setDialog} onReEntry={() => {
          addReEntry(id);
          undo.show(`Re-entry added (${money(s.buyIn + s.fee, s.currency)})`, () => undoReEntry(id));
        }} />
      )}

      <button className="btn block" style={{ marginBottom: 12 }} onClick={() => toggleBreak(id)}>
        {paused ? '▶ Resume play' : '⏸ Take a break'}
      </button>

      {s.stackChecks.length > 0 && (
        <div className="card">
          <h2>Stack</h2>
          <LineChart
            label="Stack over the session"
            height={140}
            series={[{ name: 'Stack', color: 'var(--series-1)', points: [
              ...(s.kind === 'cash' ? [{ t: s.startedAt, v: s.buyIns[0].amount }] : s.startingStack ? [{ t: s.startedAt, v: s.startingStack }] : []),
              ...s.stackChecks.map((c) => ({ t: c.at, v: c.amount })),
            ] }]}
            format={(v) => (s.kind === 'cash' ? money(v, s.currency) : v.toLocaleString('fi-FI'))}
          />
        </div>
      )}

      <NotesCard s={s} />

      {undo.el}

      {dialog === 'rebuy' && s.kind === 'cash' && (
        <AmountSheet title="Rebuy / top-up" label="Amount" currency={s.currency} confirm="Add" quick={s.buyIns.map((b) => b.amount)} onClose={close} onSubmit={(v) => { addBuyIn(id, v); close(); }} />
      )}
      {dialog === 'stack' && (
        <AmountSheet title="Stack check" label={s.kind === 'cash' ? 'Current stack' : 'Chips'} currency={s.kind === 'cash' ? s.currency : 'EUR'} confirm="Save" initial={lastStack} onClose={close} onSubmit={(v) => { addStackCheck(id, v); close(); }} />
      )}
      {dialog === 'cashout' && s.kind === 'cash' && (
        <AmountSheet
          title="Cash out"
          label="Cashing out with"
          currency={s.currency}
          confirm="End session"
          allowZero
          initial={lastStack}
          quick={[0, ...(lastStack ? [lastStack] : []), cashBuyInTotal(s)]}
          onClose={close}
          onSubmit={async (v) => {
            await endCash(id, v);
            go(`/done/${id}`, true);
          }}
        />
      )}
      {dialog === 'addon' && s.kind === 'tournament' && (
        <AmountSheet title="Add-on" label="Add-on cost" currency={s.currency} confirm="Add" quick={[s.buyIn + s.fee, ...s.addOns.map((a) => a.amount)]} onClose={close} onSubmit={(v) => { addAddOn(id, v); close(); }} />
      )}
      {dialog === 'bounty' && s.kind === 'tournament' && (
        <AmountSheet title="Bounty won" label="Bounty amount" currency={s.currency} confirm="Add" onClose={close} onSubmit={(v) => { addBounty(id, v); close(); }} />
      )}
      {(dialog === 'bust' || dialog === 'cashed') && s.kind === 'tournament' && (
        <FinishSheet s={s} cashed={dialog === 'cashed'} onClose={close} />
      )}
    </>
  );
}

function CashPanel({ s, lastStack, setDialog, onRebuy }: { s: CashSession; lastStack?: number; setDialog: (d: Dialog) => void; onRebuy: () => void }) {
  const inFor = cashBuyInTotal(s);
  const lastBuy = s.buyIns[s.buyIns.length - 1].amount;
  return (
    <>
      <div className="live-numbers">
        <div>
          <div className="label">In for</div>
          <div className="value">{money(inFor, s.currency)}</div>
        </div>
        <div>
          <div className="label">Last stack</div>
          <div className="value">{lastStack !== undefined ? money(lastStack, s.currency) : '–'}</div>
        </div>
        <div>
          <div className="label">Up / down</div>
          <div className={`value ${tone(lastStack !== undefined ? lastStack - inFor : undefined)}`}>
            {lastStack !== undefined ? signed(lastStack - inFor) : '–'}
          </div>
        </div>
      </div>
      <div className="grid2" style={{ marginBottom: 10 }}>
        <button className="btn huge" onClick={onRebuy}>
          + Rebuy<small>{money(lastBuy, s.currency)}</small>
        </button>
        <button className="btn huge" onClick={() => setDialog('stack')}>
          Stack<small>check</small>
        </button>
      </div>
      <div className="grid2" style={{ marginBottom: 10 }}>
        <button className="btn" onClick={() => setDialog('rebuy')}>
          Other amount
        </button>
        <button className="btn primary" onClick={() => setDialog('cashout')}>
          Cash out
        </button>
      </div>
    </>
  );
}

function TournamentPanel({ s, lastStack, setDialog, onReEntry }: { s: TournamentSession; lastStack?: number; setDialog: (d: Dialog) => void; onReEntry: () => void }) {
  return (
    <>
      <div className="live-numbers">
        <div>
          <div className="label">Cost</div>
          <div className="value">{money(tournamentCost(s), s.currency)}</div>
        </div>
        <div>
          <div className="label">Entries</div>
          <div className="value">{s.entries}</div>
        </div>
        <div>
          <div className="label">{lastStack !== undefined ? 'Stack' : 'Bounties'}</div>
          <div className="value">{lastStack !== undefined ? lastStack.toLocaleString('fi-FI') : money(s.bountiesWon, s.currency)}</div>
        </div>
      </div>
      <div className="grid3" style={{ marginBottom: 10 }}>
        <button className="btn huge" onClick={() => setDialog('stack')}>
          Stack<small>chips</small>
        </button>
        <button className="btn huge" onClick={onReEntry}>
          Re-entry<small>{money(s.buyIn + s.fee, s.currency)}</small>
        </button>
        <button className="btn huge" onClick={() => setDialog('addon')}>
          Add-on<small>{s.addOns.length ? `${s.addOns.length} so far` : 'cost'}</small>
        </button>
      </div>
      <div className="grid3" style={{ marginBottom: 10 }}>
        <button className="btn" onClick={() => setDialog('bounty')}>
          Bounty +
        </button>
        <button className="btn danger" onClick={() => setDialog('bust')}>
          Busted
        </button>
        <button className="btn primary" onClick={() => setDialog('cashed')}>
          Cashed
        </button>
      </div>
    </>
  );
}

function FinishSheet({ s, cashed, onClose }: { s: TournamentSession; cashed: boolean; onClose: () => void }) {
  const [finish, setFinish] = useState<number>();
  const [field, setField] = useState<number | undefined>(s.fieldSize);
  const [prize, setPrize] = useState<number | undefined>(cashed ? undefined : 0);
  const ok = (!cashed || (prize ?? 0) > 0) && (!finish || !field || finish <= field);
  return (
    <Sheet title={cashed ? 'In the money 🎉' : 'Busted'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          await endTournament(s.id!, { prize: prize ?? 0, finish, fieldSize: field });
          go(`/done/${s.id}`, true);
        }}
      >
        {cashed && <MoneyField label="Prize" value={prize} onChange={setPrize} currency={s.currency} autoFocus />}
        <div className="grid2">
          <IntField label="Finished" value={finish} onChange={setFinish} autoFocus={!cashed} />
          <IntField label="Of (entries)" value={field} onChange={setField} />
        </div>
        <p className="hint" style={{ marginTop: -6 }}>Finish and field size drive your finish-percentile stats. Leave blank if unknown.</p>
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!ok}>
            End tournament
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function NotesCard({ s }: { s: Session }) {
  const [text, setText] = useState(s.notes);
  return (
    <div className="card">
      <label className="field" style={{ marginBottom: 0 }}>
        <span>Notes</span>
        <textarea
          value={text}
          placeholder="Table dynamics, players, hands to review…"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== s.notes && db.sessions.update(s.id!, { notes: text })}
        />
      </label>
    </div>
  );
}
