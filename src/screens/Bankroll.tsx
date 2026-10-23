import { useState } from 'react';
import { db, updateSettings } from '../db/db';
import type { Transaction } from '../db/schema';
import { useData } from '../lib/data';
import { date, money, moneyRound, signed } from '../lib/format';
import { bankrollSeries, currentBankroll } from '../lib/stats';
import { LineChart } from '../components/charts/LineChart';
import { MoneyField, Seg, Sheet, Top } from '../components/ui';

export function Bankroll() {
  const { sessions, transactions, settings, loaded } = useData();
  const [adding, setAdding] = useState(false);
  const [editStart, setEditStart] = useState(false);
  if (!loaded) return null;

  const br = currentBankroll(sessions, transactions, settings.startingBankroll);
  const series = bankrollSeries(sessions, transactions, settings.startingBankroll);

  return (
    <>
      <Top title="Bankroll" />
      <div className="card">
        <div className="hero-label">Current bankroll</div>
        <div className="hero">{moneyRound(br)}</div>
        <div className="hint" style={{ marginBottom: 12 }}>
          Start {money(settings.startingBankroll)} ·{' '}
          <button className="btn ghost" style={{ minHeight: 0, padding: 0, fontSize: 13 }} onClick={() => setEditStart(true)}>
            change
          </button>
        </div>
        <LineChart label="Bankroll over time" area format={(v) => moneyRound(v)} series={[{ name: 'Bankroll', color: 'var(--series-1)', points: series }]} />
      </div>

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Deposits & withdrawals</span>
        <button className="btn ghost" style={{ minHeight: 0, padding: 0, textTransform: 'none', letterSpacing: 0 }} onClick={() => setAdding(true)}>
          + Add
        </button>
      </div>
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {transactions.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>
            Money you add to or take from the poker bankroll.
          </div>
        ) : (
          <ul className="list">
            {[...transactions].reverse().map((t) => (
              <li key={t.id} className="item">
                <span className="main">
                  <div className="title">{t.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</div>
                  <div className="meta">
                    {date(t.at)}
                    {t.note ? ` · ${t.note}` : ''}
                  </div>
                </span>
                <span className="amt">{signed(t.type === 'deposit' ? t.amount : -t.amount)}</span>
                <button
                  className="btn ghost"
                  aria-label="Delete"
                  style={{ minHeight: 36, padding: '0 6px', color: 'var(--muted)' }}
                  onClick={() => confirm('Delete this entry?') && db.transactions.delete(t.id!)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {adding && <TxSheet onClose={() => setAdding(false)} />}
      {editStart && <StartSheet initial={settings.startingBankroll} onClose={() => setEditStart(false)} />}
    </>
  );
}

function TxSheet({ onClose }: { onClose: () => void }) {
  const [tx, setTx] = useState<Transaction>({ at: Date.now(), type: 'deposit', amount: 0, note: '' });
  return (
    <Sheet title="Bankroll entry" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(tx.amount > 0)) return;
          await db.transactions.add(tx);
          onClose();
        }}
      >
        <Seg value={tx.type} onChange={(type) => setTx({ ...tx, type })} options={[{ value: 'deposit', label: 'Deposit' }, { value: 'withdrawal', label: 'Withdrawal' }]} />
        <div style={{ height: 12 }} />
        <MoneyField label="Amount" value={tx.amount || undefined} onChange={(v) => setTx({ ...tx, amount: v ?? 0 })} autoFocus />
        <label className="field">
          <span>Note</span>
          <input value={tx.note} onChange={(e) => setTx({ ...tx, note: e.target.value })} />
        </label>
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!(tx.amount > 0)}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function StartSheet({ initial, onClose }: { initial: number; onClose: () => void }) {
  const [v, setV] = useState<number | undefined>(initial);
  return (
    <Sheet title="Starting bankroll" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await updateSettings({ startingBankroll: v ?? 0 });
          onClose();
        }}
      >
        <MoneyField label="Amount you started tracking with" value={v} onChange={setV} autoFocus />
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Sheet>
  );
}
