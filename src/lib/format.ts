const pad = (n: number) => String(n).padStart(2, '0');

const eur0 = new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 });
const num1 = new Intl.NumberFormat('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat('fi-FI', { style: 'percent', maximumFractionDigits: 1 });

/** 1 234 € — cents only when there are any. */
export function money(v: number | undefined, currency = 'EUR'): string {
  if (v === undefined || !Number.isFinite(v)) return '–';
  if (currency !== 'EUR') {
    return new Intl.NumberFormat('fi-FI', { style: 'currency', currency, maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
  }
  return Number.isInteger(Math.round(v * 100) / 100) ? eur0.format(v) : eur2.format(v);
}

/** Whole euros, for stat tiles and axes. */
export const moneyRound = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '–' : eur0.format(Math.round(v)));

/** +1 234 € / −567 €: sign always shown so colour never carries the meaning alone. */
export function signed(v: number | undefined, round = false): string {
  if (v === undefined || !Number.isFinite(v)) return '–';
  const body = round ? eur0.format(Math.abs(Math.round(v))) : money(Math.abs(v));
  if (Math.abs(v) < 0.005) return body;
  return (v > 0 ? '+' : '−') + body;
}

export const tone = (v: number | undefined) => (v === undefined || Math.abs(v) < 0.005 ? '' : v > 0 ? 'pos' : 'neg');

export const number = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '–' : num.format(v));
export const percent = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '–' : pct.format(v));
export const signedPercent = (v: number | undefined) =>
  v === undefined || !Number.isFinite(v) ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + pct.format(Math.abs(v));

export const date = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
export const time = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const dateTime = (t: number) => `${date(t)} ${time(t)}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (key: string, withYear = true) => {
  const [y, m] = key.split('-').map(Number);
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
};
export const weekday = (t: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(t).getDay()];

/** 3 h 25 min, or 0:42:10 style for the live clock. */
export function duration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} h ${pad(m)} min` : `${m} min`;
}
export function clock(hours: number): string {
  const s = Math.floor(hours * 3600);
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
export const hoursShort = (h: number) => `${num1.format(h)} h`;

/** Parses "1 234,50", "1234.5", "1,5k" style input. Returns undefined for blank or garbage. */
export function parseAmount(raw: string): number | undefined {
  let s = raw.trim().toLowerCase().replace(/[\s  €$£]/g, '');
  if (!s) return undefined;
  let mult = 1;
  if (s.endsWith('k')) {
    mult = 1000;
    s = s.slice(0, -1);
  }
  // A lone comma is the Finnish decimal separator; with both, the last one is decimal.
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : undefined;
}

/** Value for a <input type="datetime-local">. */
export const toLocalInput = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => new Date(v).getTime();
