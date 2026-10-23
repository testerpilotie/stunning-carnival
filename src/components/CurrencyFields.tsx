import { useState } from 'react';
import { CURRENCIES } from '../db/schema';
import { fetchFx } from '../lib/data';
import { MoneyField } from './ui';

/** Currency select plus, for anything but EUR, the FX rate fixed for this session. */
export function CurrencyFields({
  currency,
  fx,
  onChange,
}: {
  currency: string;
  fx: number;
  onChange: (currency: string, fx: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <>
      <label className="field">
        <span>Currency</span>
        <select value={currency} onChange={(e) => onChange(e.target.value, e.target.value === 'EUR' ? 1 : fx === 1 ? 0 : fx)}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {currency !== 'EUR' && (
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <MoneyField
            label={`1 ${currency} in EUR`}
            value={fx || undefined}
            onChange={(v) => onChange(currency, v ?? 0)}
            hint={err || 'Fixed for this session; all stats are in EUR.'}
          />
          <button
            type="button"
            className="btn"
            style={{ flex: 'none', marginTop: 26 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              const r = await fetchFx(currency);
              setBusy(false);
              if (r) onChange(currency, r);
              else setErr('Could not fetch a rate — enter it by hand.');
            }}
          >
            {busy ? '…' : 'Fetch'}
          </button>
        </div>
      )}
    </>
  );
}
