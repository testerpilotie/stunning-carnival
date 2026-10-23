import { describe, expect, it } from 'vitest';
import {
  bankrollSeries,
  bbPerHour,
  buyInBand,
  cumulative,
  drawdown,
  finishHistogram,
  hourlyEstimate,
  monthly,
  totals,
  tournamentStats,
} from '../src/lib/stats';
import { H, T0, cash, mtt } from './fixtures';

const D = 24 * H;

describe('drawdown', () => {
  const pts = [0, 100, 40, 120, -30, 50, 130, 90].map((v, i) => ({ t: i, v }));
  it('finds the largest peak-to-trough fall', () => {
    const d = drawdown(pts);
    expect(d.max).toBe(150);
    expect(d.peakAt).toBe(3);
    expect(d.troughAt).toBe(4);
    expect(d.recoveredAt).toBe(6);
  });
  it('has no recovery while still under the old peak', () => {
    const d = drawdown([0, 100, -50, 20].map((v, i) => ({ t: i, v })));
    expect(d.max).toBe(150);
    expect(d.recoveredAt).toBeUndefined();
  });
});

describe('totals and cumulative', () => {
  const ss = [
    cash({ startedAt: T0, endedAt: T0 + 4 * H, cashOut: 400 }), // +200
    cash({ startedAt: T0 + D, endedAt: T0 + D + 2 * H, cashOut: 100 }), // -100
    mtt({ startedAt: T0 + 2 * D, endedAt: T0 + 2 * D + 6 * H, prize: 500 }), // +400
  ];
  it('sums results and hours', () => {
    const t = totals(ss);
    expect(t.result).toBe(500);
    expect(t.hours).toBeCloseTo(12);
    expect(t.winningSessions).toBe(2);
    expect(t.best).toBe(400);
    expect(t.worst).toBe(-100);
  });
  it('cumulative starts at zero and ends at the total', () => {
    const c = cumulative(ss);
    expect(c.map((p) => p.v)).toEqual([0, 200, 100, 500]);
  });
});

describe('hourlyEstimate', () => {
  it('pooled rate and a CI that contains it', () => {
    const ss = [
      cash({ endedAt: T0 + 4 * H, cashOut: 400 }),
      cash({ endedAt: T0 + 4 * H, cashOut: 0 }),
      cash({ endedAt: T0 + 2 * H, cashOut: 300 }),
    ];
    const e = hourlyEstimate(ss)!;
    expect(e.rate).toBeCloseTo(100 / 10);
    expect(e.low).toBeLessThan(e.rate);
    expect(e.high).toBeGreaterThan(e.rate);
    expect(e.hours).toBeCloseTo(10);
  });
  it('needs two sessions', () => {
    expect(hourlyEstimate([cash()])).toBeUndefined();
  });
  it('bb/h uses each session’s own big blind', () => {
    const ss = [cash({ bb: 2, cashOut: 240 }), cash({ bb: 5, sb: 2, buyIns: [{ at: T0, amount: 500 }], cashOut: 600 })];
    // +20 bb and +20 bb over 8 hours
    expect(bbPerHour(ss)).toBeCloseTo(5);
  });
});

describe('tournamentStats', () => {
  const ts = [
    mtt({ prize: 0, finish: 80, fieldSize: 100 }),
    mtt({ entries: 2, prize: 0, finish: 40, fieldSize: 100 }),
    mtt({ prize: 1000, finish: 5, fieldSize: 100, bountiesWon: 100 }),
    mtt({ buyIn: 450, fee: 50, prize: 0 }),
  ];
  it('ROI, ITM and finals', () => {
    const s = tournamentStats(ts);
    expect(s.invested).toBe(100 + 200 + 100 + 500);
    expect(s.result).toBe(1100 - 900);
    expect(s.roi).toBeCloseTo(200 / 900);
    expect(s.itm).toBe(0.25);
    expect(s.finalTables).toBe(1);
    expect(s.bounties).toBe(100);
    expect(s.biggestCash).toBe(1000);
    expect(s.entries).toBe(5);
  });
  it('bands and histogram', () => {
    expect(buyInBand(ts[0])).toBe('< 150 €');
    expect(buyInBand(ts[3])).toBe('500 €+');
    const h = finishHistogram(ts);
    expect(h[0]).toBe(1);
    expect(h[3]).toBe(1);
    expect(h[7]).toBe(1);
  });
});

describe('monthly', () => {
  it('fills empty months', () => {
    const ss = [cash({ endedAt: new Date('2026-01-15').getTime(), cashOut: 300 }), cash({ endedAt: new Date('2026-03-02').getTime(), cashOut: 100 })];
    expect(monthly(ss)).toEqual([
      { key: '2026-01', v: 100 },
      { key: '2026-02', v: 0 },
      { key: '2026-03', v: -100 },
    ]);
  });
});

describe('bankroll', () => {
  it('applies start, sessions and transactions in order', () => {
    const s = bankrollSeries(
      [cash({ endedAt: T0 + 2 * D, cashOut: 300 })],
      [{ at: T0, type: 'deposit', amount: 500, note: '' }, { at: T0 + 3 * D, type: 'withdrawal', amount: 200, note: '' }],
      1000,
    );
    expect(s.map((p) => p.v)).toEqual([1000, 1500, 1600, 1400]);
  });
  it('ignores live sessions', () => {
    expect(bankrollSeries([cash({ status: 'live' })], [], 100)).toEqual([]);
  });
});

describe('tournamentStats with rebuys', () => {
  it('counts rebuys in invested and ROI', () => {
    const s = tournamentStats([mtt({ rebuys: [{ at: T0, amount: 100 }], prize: 400 })]);
    expect(s.invested).toBe(200);
    expect(s.roi).toBeCloseTo(1);
    expect(s.rebuys).toBe(1);
  });
});

describe('expenses', () => {
  it('are totalled in EUR and kept out of the result', () => {
    const t = totals([cash({ cashOut: 300, expenses: 50 }), cash({ currency: 'USD', fxToEur: 0.9, buyIns: [{ at: T0, amount: 200 }], cashOut: 200, expenses: 100 })]);
    expect(t.result).toBe(100);
    expect(t.expenses).toBeCloseTo(140);
  });
});
