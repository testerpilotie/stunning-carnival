import { useCallback, useRef, useState } from 'react';

/** Rounded tick values covering [min, max], always including 0 when in range. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** 0 / 500 / 1K / 2,5K style axis labels. */
export function compact(v: number, unit = '€'): string {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  let body: string;
  if (a >= 1e6) body = `${(a / 1e6).toLocaleString('fi-FI', { maximumFractionDigits: 1 })}M`;
  else if (a >= 1e3) body = `${(a / 1e3).toLocaleString('fi-FI', { maximumFractionDigits: 1 })}K`;
  else body = a.toLocaleString('fi-FI', { maximumFractionDigits: 1 });
  return `${sign}${body}${unit ? ' ' + unit : ''}`;
}

/** Container width, tracked with ResizeObserver. A callback ref so it works when the element mounts late. */
export function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [w, setW] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    setW(el.clientWidth);
    ro.current = new ResizeObserver(() => setW(el.clientWidth));
    ro.current.observe(el);
  }, []);
  return [ref, w];
}

/** Path for a bar growing from the baseline with 4px rounded data end and a square base. */
export function barPath(x: number, w: number, y0: number, y1: number, r = 4): string {
  const h = Math.abs(y1 - y0);
  const rr = Math.min(r, w / 2, h);
  if (h < 0.5) return '';
  if (y1 < y0) {
    // grows up
    return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 - rr}V${y0}Z`;
}
