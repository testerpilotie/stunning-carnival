import type { Point } from '../../lib/stats';
import { useWidth } from './util';

export function Sparkline({ points, height = 44, color = 'var(--series-1)' }: { points: Point[]; height?: number; color?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  if (points.length < 2) return null;
  const vs = points.map((p) => p.v);
  const min = Math.min(0, ...vs);
  const max = Math.max(0, ...vs);
  const pad = 5;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = points[points.length - 1];
  return (
    <div ref={ref} className="chart" aria-hidden="true">
      {width > 0 && (
        <svg height={height}>
          <line className="baseline" x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} />
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(points.length - 1)} cy={y(last.v)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}
