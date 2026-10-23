import { useEffect, useRef, useState, type ReactNode } from 'react';
import { back } from '../lib/router';
import { money, parseAmount } from '../lib/format';

export function Top({ title, backTo, right }: { title: string; backTo?: string; right?: ReactNode }) {
  return (
    <header className="top">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {backTo !== undefined && (
          <button className="back" onClick={() => back(backTo)} aria-label="Back">
            ‹ Back
          </button>
        )}
        {backTo === undefined && <h1>{title}</h1>}
      </div>
      {backTo !== undefined && <strong style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</strong>}
      <div style={{ minWidth: backTo !== undefined ? 60 : 0, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </header>
  );
}

export function Tile({ label, value, note, toneClass }: { label: string; value: ReactNode; note?: ReactNode; toneClass?: string }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className={`value ${toneClass ?? ''}`}>{value}</div>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/** Text input for money: decimal keyboard, accepts "1 234,5". */
export function MoneyField({
  label,
  value,
  onChange,
  currency = 'EUR',
  autoFocus,
  hint,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  currency?: string;
  autoFocus?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value).replace('.', ','));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value === undefined ? '' : String(value).replace('.', ','));
    }
  }, [value]);
  return (
    <label className="field">
      <span>
        {label} {currency !== 'EUR' && <span className="hint">({currency})</span>}
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseAmount(e.target.value);
          last.current = n;
          onChange(n);
        }}
      />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function IntField({ label, value, onChange, autoFocus, hint }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; autoFocus?: boolean; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus={autoFocus}
        value={value ?? ''}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
      />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

/** Bottom sheet asking for one amount, with quick-pick chips. */
export function AmountSheet({
  title,
  label,
  initial,
  quick = [],
  currency,
  confirm,
  onSubmit,
  onClose,
  allowZero,
}: {
  title: string;
  label: string;
  initial?: number;
  quick?: number[];
  currency: string;
  confirm: string;
  onSubmit: (v: number) => void;
  onClose: () => void;
  allowZero?: boolean;
}) {
  const [v, setV] = useState<number | undefined>(initial);
  const ok = v !== undefined && (allowZero ? v >= 0 : v > 0);
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSubmit(v!);
        }}
      >
        <MoneyField label={label} value={v} onChange={setV} currency={currency} autoFocus />
        {quick.length > 0 && (
          <div className="keypad-quick">
            {[...new Set(quick)].map((q) => (
              <button type="button" key={q} onClick={() => setV(q)}>
                {money(q, currency)}
              </button>
            ))}
          </div>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!ok}>
            {confirm}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button type="button" key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Re-renders every `ms` so live timers tick. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
