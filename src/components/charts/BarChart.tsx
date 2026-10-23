import { useState } from 'react';
import { barPath, compact, niceTicks, useWidth } from './util';

export interface Bar {
  key: string;
  label: string;
  /** Longer label for the tooltip. */
  title?: string;
  v: number;
}

interface Props {
  bars: Bar[];
  height?: number;
  format: (v: number) => string;
  label: string;
  /** Positive and negative bars in the two diverging hues; otherwise a single series colour. */
  diverging?: boolean;
  color?: string;
  unit?: string;
  /** Extra line in the tooltip, e.g. sample size. */
  detail?: (b: Bar) => string;
}

const PAD = { top: 18, right: 4, bottom: 22, left: 48 };

export function BarChart({ bars, height = 180, format, label, diverging, color = 'var(--series-1)', unit = '€', detail }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!bars.length) return <div className="empty">Not enough data yet</div>;

  // 15% headroom past the extremes so their value labels never hit the axis text.
  const lo = Math.min(0, ...bars.map((b) => b.v));
  const hi = Math.max(0, ...bars.map((b) => b.v));
  const ticks = niceTicks(lo * 1.15, hi * 1.15);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const band = iw / bars.length;
  const bw = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * ih;
  const fill = (v: number) => (diverging ? (v >= 0 ? 'var(--div-pos)' : 'var(--div-neg)') : color);

  // Label only the extremes so the chart never drowns in numbers.
  const maxI = bars.reduce((m, b, i) => (b.v > bars[m].v ? i : m), 0);
  const minI = bars.reduce((m, b, i) => (b.v < bars[m].v ? i : m), 0);
  const labelled = new Set([maxI, ...(bars[minI].v < 0 ? [minI] : [])]);
  // Thin out x labels when crowded.
  const every = Math.ceil(bars.length / Math.max(1, Math.floor(iw / 34)));

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg height={height} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
          <g className="grid">
            {ticks.map((v) => (
              <line key={v} x1={PAD.left} x2={PAD.left + iw} y1={y(v)} y2={y(v)} />
            ))}
          </g>
          {ticks.map((v) => (
            <text key={v} className="tick" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">
              {compact(v, unit)}
            </text>
          ))}
          {bars.map((b, i) => {
            const cx = PAD.left + band * i + band / 2;
            return (
              <g key={b.key}>
                <path className={`bar${hover === i ? ' active' : ''}`} d={barPath(cx - bw / 2, bw, y(0), y(b.v))} fill={fill(b.v)} />
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={ih}
                  fill="transparent"
                  tabIndex={0}
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
                {labelled.has(i) && b.v !== 0 && bw >= 8 && (
                  <text className="tick" x={cx} y={b.v >= 0 ? y(b.v) - 5 : y(b.v) + 13} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>
                    {compact(b.v, unit)}
                  </text>
                )}
                {i % every === 0 && (
                  <text className="tick" x={cx} y={height - 6} textAnchor="middle">
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
          <line className="baseline" x1={PAD.left} x2={PAD.left + iw} y1={y(0)} y2={y(0)} />
        </svg>
      )}
      {hover !== null && (
        <div
          className="tooltip"
          style={{ top: 0, left: Math.min(Math.max(0, PAD.left + band * hover + band / 2 - 60), Math.max(0, width - 140)) }}
        >
          <div>{bars[hover].title ?? bars[hover].label}</div>
          <div className="tv">
            <span className="key" style={{ background: fill(bars[hover].v) }} />
            {format(bars[hover].v)}
          </div>
          {detail && <div>{detail(bars[hover])}</div>}
        </div>
      )}
    </div>
  );
}
