import { useEffect, useMemo, useState } from 'react';
import type { CashSession, Kind, Session, TournamentSession, Venue } from '../db/schema';
import { TOURNAMENT_FORMATS } from '../db/schema';
import { createSession, lastOfKind } from '../lib/actions';
import { stakeLabel } from '../lib/calc';
import { useData } from '../lib/data';
import { money } from '../lib/format';
import { go } from '../lib/router';
import { CurrencyFields } from '../components/CurrencyFields';
import { VenuePicker } from '../components/VenuePicker';
import { IntField, MoneyField, Top } from '../components/ui';

const AGO = [0, 15, 30, 60];

export function StartSession({ kind }: { kind: Kind }) {
  const { sessions, venues, settings } = useData();
  const [ready, setReady] = useState(false);
  const [venueId, setVenueId] = useState<number>();
  const [game, setGame] = useState('NLH');
  const [currency, setCurrency] = useState('EUR');
  const [fx, setFx] = useState(1);
  const [ago, setAgo] = useState(0);
  // cash
  const [sb, setSb] = useState<number | undefined>(1);
  const [bb, setBb] = useState<number | undefined>(2);
  const [buyIn, setBuyIn] = useState<number | undefined>(200);
  // tournament
  const [eventName, setEventName] = useState('');
  const [tBuyIn, setTBuyIn] = useState<number | undefined>();
  const [fee, setFee] = useState<number | undefined>(0);
  const [startingStack, setStartingStack] = useState<number>();
  const [fieldSize, setFieldSize] = useState<number>();
  const [guarantee, setGuarantee] = useState<number>();
  const [formats, setFormats] = useState<string[]>([]);

  // Prefill from the previous session of this kind.
  useEffect(() => {
    lastOfKind(kind).then((last) => {
      if (last) {
        setVenueId(last.venueId);
        setGame(last.game);
        setCurrency(last.currency);
        setFx(last.fxToEur);
        if (last.kind === 'cash') {
          setSb(last.sb);
          setBb(last.bb);
          setBuyIn(last.buyIns[0]?.amount);
        } else {
          setEventName(last.eventName);
          setTBuyIn(last.buyIn);
          setFee(last.fee);
          setStartingStack(last.startingStack);
          setFormats(last.formats);
        }
      }
      setReady(true);
    });
  }, [kind]);

  const cashHistory = sessions.filter((s): s is CashSession => s.kind === 'cash');
  const stakeChips = useMemo(() => {
    const seen = new Map<string, [number, number]>();
    for (const s of [...cashHistory].reverse()) seen.set(stakeLabel(s), [s.sb, s.bb]);
    for (const d of [[0.5, 1], [1, 2], [2, 5]] as [number, number][]) seen.set(`${d[0]}/${d[1]}`.replace('.', ','), d);
    return [...seen.entries()].slice(0, 5);
  }, [cashHistory]);
  const buyInChips = useMemo(
    () => [...new Set([...cashHistory].reverse().map((s) => s.buyIns[0]?.amount).filter((x): x is number => !!x))].slice(0, 4),
    [cashHistory],
  );
  const eventNames = useMemo(
    () => [...new Set(sessions.filter((s): s is TournamentSession => s.kind === 'tournament').map((s) => s.eventName).filter(Boolean))],
    [sessions],
  );

  const onVenue = (v: Venue | undefined) => {
    setVenueId(v?.id);
    if (v && v.defaultCurrency !== currency) {
      setCurrency(v.defaultCurrency);
      setFx(v.defaultCurrency === 'EUR' ? 1 : (settings.fxMemory[v.defaultCurrency] ?? 0));
    }
  };

  const fxOk = currency === 'EUR' || fx > 0;
  const valid = fxOk && (kind === 'cash' ? !!bb && !!buyIn : tBuyIn !== undefined && tBuyIn >= 0);

  const start = async () => {
    const startedAt = Date.now() - ago * 60_000;
    const base = {
      status: 'live' as const,
      startedAt,
      breaks: [],
      venueId,
      game,
      currency,
      fxToEur: currency === 'EUR' ? 1 : fx,
      tags: [],
      notes: '',
      stackChecks: [],
      expenses: 0,
    };
    const s: Session =
      kind === 'cash'
        ? { ...base, kind: 'cash', sb: sb ?? 0, bb: bb!, buyIns: [{ at: startedAt, amount: buyIn! }] }
        : {
            ...base,
            kind: 'tournament',
            eventName: eventName.trim(),
            buyIn: tBuyIn ?? 0,
            fee: fee ?? 0,
            entries: 1,
            addOns: [],
            bountiesWon: 0,
            prize: 0,
            fieldSize,
            guarantee,
            startingStack,
            formats,
          };
    const id = await createSession(s);
    go(`/live/${id}`, true);
  };

  if (!ready) return null;

  return (
    <>
      <Top title={kind === 'cash' ? 'Start cash game' : 'Start tournament'} backTo="/" />
      <div className="card">
        <VenuePicker venues={venues} value={venueId} onChange={onVenue} />
        <div className="field">
          <span>Game</span>
          <div className="chips">
            {settings.games.map((g) => (
              <button type="button" key={g} className="chip" aria-pressed={game === g} onClick={() => setGame(g)}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {kind === 'cash' ? (
          <>
            <div className="field">
              <span>Stakes</span>
              <div className="chips">
                {stakeChips.map(([label, [s, b]]) => (
                  <button
                    type="button"
                    key={label}
                    className="chip"
                    aria-pressed={sb === s && bb === b}
                    onClick={() => {
                      setSb(s);
                      setBb(b);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid2">
              <MoneyField label="Small blind" value={sb} onChange={setSb} currency={currency} />
              <MoneyField label="Big blind" value={bb} onChange={setBb} currency={currency} />
            </div>
            <MoneyField label="Buy-in" value={buyIn} onChange={setBuyIn} currency={currency} />
            {buyInChips.length > 0 && (
              <div className="keypad-quick">
                {buyInChips.map((b) => (
                  <button type="button" key={b} onClick={() => setBuyIn(b)}>
                    {money(b, currency)}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <label className="field">
              <span>Event</span>
              <input list="event-names" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Friday Deepstack" />
              <datalist id="event-names">
                {eventNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            <div className="grid2">
              <MoneyField label="Buy-in (to prize pool)" value={tBuyIn} onChange={setTBuyIn} currency={currency} />
              <MoneyField label="Fee / rake" value={fee} onChange={setFee} currency={currency} />
            </div>
            <p className="hint" style={{ marginTop: -6 }}>
              Entry costs {money((tBuyIn ?? 0) + (fee ?? 0), currency)}. If you only know the total, put it all in buy-in.
            </p>
            <div className="field">
              <span>Format</span>
              <div className="chips">
                {TOURNAMENT_FORMATS.map((f) => (
                  <button
                    type="button"
                    key={f}
                    className="chip"
                    aria-pressed={formats.includes(f)}
                    onClick={() => setFormats(formats.includes(f) ? formats.filter((x) => x !== f) : [...formats, f])}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid2">
              <IntField label="Starting stack" value={startingStack} onChange={setStartingStack} />
              <IntField label="Field size (if known)" value={fieldSize} onChange={setFieldSize} />
            </div>
            <MoneyField label="Guarantee (optional)" value={guarantee} onChange={setGuarantee} currency={currency} />
          </>
        )}

        <CurrencyFields
          currency={currency}
          fx={fx}
          onChange={(c, r) => {
            setCurrency(c);
            setFx(c === 'EUR' ? 1 : r || settings.fxMemory[c] || 0);
          }}
        />

        <div className="field">
          <span>Started</span>
          <div className="chips">
            {AGO.map((m) => (
              <button type="button" key={m} className="chip" aria-pressed={ago === m} onClick={() => setAgo(m)}>
                {m === 0 ? 'Now' : `${m} min ago`}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button className="btn primary big block" disabled={!valid} onClick={start}>
        Start {kind === 'cash' ? 'session' : 'tournament'}
      </button>
    </>
  );
}
