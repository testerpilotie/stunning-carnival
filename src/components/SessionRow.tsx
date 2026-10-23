import type { Session, Venue } from '../db/schema';
import { expensesEur, hoursPlayed, resultEur } from '../lib/calc';
import { headline, subline } from '../lib/data';
import { date, duration, money, signed, tone } from '../lib/format';

export function SessionRow({ s, venueById }: { s: Session; venueById: Map<number, Venue> }) {
  const r = resultEur(s);
  const live = s.status === 'live';
  const extra = s.kind === 'tournament' && s.finish ? ` · ${s.finish}${s.fieldSize ? `/${s.fieldSize}` : ''}` : '';
  return (
    <li>
      <a className="item" href={live ? `#/live/${s.id}` : `#/session/${s.id}`}>
        <span className={`badge ${s.kind}`} aria-label={s.kind === 'cash' ? 'Cash game' : 'Tournament'}>
          {s.kind === 'cash' ? 'CG' : 'MTT'}
        </span>
        <span className="main">
          <div className="title">{headline(s)}</div>
          <div className="meta">
            {[date(s.startedAt), subline(s, venueById)].filter(Boolean).join(' · ')}
            {extra}
          </div>
        </span>
        <span className={`amt ${live ? '' : tone(r)}`}>
          {live ? 'LIVE' : signed(r)}
          <small>{duration(hoursPlayed(s))}</small>
          {s.expenses > 0 && <small>exp. {money(Math.round(expensesEur(s)))}</small>}
        </span>
      </a>
    </li>
  );
}
