import { useState } from 'react';
import type { Point } from '../../lib/stats';
import { date, dateTime, time } from '../../lib/format';
import { compact, niceTicks, useWidth } from './util';

export interface LineSeries {
  name: string;
  color: string;
  points: Point[];
}

interface Props {
  series: LineSeries[];
  height?: number;
  /** Fill the area between the line and zero with a 10% wash. */
  area?: boolean;
  format: (v: number) => string;
  label: string;
}

const PAD = { top: 12, right: 8, bottom: 24, left: 52 };

/** Value of a step series at time t: the last point at or before t. */
function valueAt(points: Point[], t: number): number | undefined {
  let v: number | undefined;
  for (const p of points) {
    if (p.t <= t) v = p.v;
    else break;
  }
  return v;
}

export function LineChart({ series, height = 200, area, format, label }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <div className="empty">Not enough data yet</div>;

  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const ticks = niceTicks(Math.min(0, ...all.map((p) => p.v)), Math.max(0, ...all.map((p) => p.v)));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * ih;

  // Snap the crosshair to real data times.
  const times = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = times[0];
    for (const t of times) if (Math.abs(x(t) - px) < Math.abs(x(best) - px)) best = t;
    setHover(best);
  };

  const xTicks = [t0, t0 + (t1 - t0) / 2, t1];
  // Within a day and a half, show clock times instead of three identical dates.
  const short = t1 - t0 < 36 * 3_600_000;
  const xLabel = short ? time : date;

  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      {width > 0 && (
        <svg
          height={height}
          role="img"
          aria-label={label}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <g className="grid">
            {ticks.map((v) => (
              <line key={v} x1={PAD.left} x2={PAD.left + iw} y1={y(v)} y2={y(v)} />
            ))}
          </g>
          {ticks.map((v) => (
            <text key={v} className="tick" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">
              {compact(v)}
            </text>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} className="tick" x={x(t)} y={height - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>
              {xLabel(t)}
            </text>
          ))}
          <line className="baseline" x1={PAD.left} x2={PAD.left + iw} y1={y(0)} y2={y(0)} />
          {series.map((s) => {
            if (!s.points.length) return null;
            const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
            const last = s.points[s.points.length - 1];
            return (
              <g key={s.name}>
                {area && (
                  <path
                    d={`${d}L${x(last.t)},${y(0)}L${x(s.points[0].t)},${y(0)}Z`}
                    fill={s.color}
                    opacity={0.1}
                  />
                )}
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(last.t)} cy={y(last.v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} />
              {series.map((s) => {
                const v = valueAt(s.points, hover);
                return v === undefined ? null : (
                  <circle key={s.name} cx={x(hover)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                );
              })}
            </g>
          )}
        </svg>
      )}
      {hover !== null && (
        <div
          className="tooltip"
          style={{
            top: 0,
            left: Math.min(Math.max(0, x(hover) - 70), Math.max(0, width - 150)),
          }}
        >
          <div>{short ? dateTime(hover) : date(hover)}</div>
          {series.map((s) => {
            const v = valueAt(s.points, hover);
            return v === undefined ? null : (
              <div key={s.name} className="tv">
                <span className="key" style={{ background: s.color }} />
                {format(v)}
                {series.length > 1 && <span style={{ fontWeight: 400, color: 'var(--ink-2)', fontSize: 12 }}>{s.name}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
