import { describe, expect, it } from 'vitest';
import { finishPercentile, hoursPlayed, investedEur, resultEur, resultLocal, stakeLabel, tournamentCost } from '../src/lib/calc';
import { parseAmount } from '../src/lib/format';
import { H, T0, cash, mtt } from './fixtures';

describe('hoursPlayed', () => {
  it('excludes breaks', () => {
    const s = cash({ breaks: [{ from: T0 + H, to: T0 + H + 0.5 * H }] });
    expect(hoursPlayed(s)).toBeCloseTo(3.5);
  });
  it('counts an open break up to now on a live session', () => {
    const s = cash({ status: 'live', endedAt: undefined, breaks: [{ from: T0 + 2 * H }] });
    expect(hoursPlayed(s, T0 + 3 * H)).toBeCloseTo(2);
  });
  it('clips breaks that spill past the end', () => {
    const s = cash({ breaks: [{ from: T0 + 3 * H, to: T0 + 10 * H }] });
    expect(hoursPlayed(s)).toBeCloseTo(3);
  });
});

describe('cash result', () => {
  it('sums rebuys', () => {
    const s = cash({ buyIns: [{ at: T0, amount: 200 }, { at: T0 + H, amount: 200 }], cashOut: 650 });
    expect(resultLocal(s)).toBe(250);
  });
  it('converts with the session FX rate', () => {
    const s = cash({ currency: 'USD', fxToEur: 0.9, buyIns: [{ at: T0, amount: 500 }], cashOut: 1000 });
    expect(resultEur(s)).toBeCloseTo(450);
    expect(investedEur(s)).toBeCloseTo(450);
  });
  it('labels stakes', () => {
    expect(stakeLabel(cash({ sb: 0.5, bb: 1 }))).toBe('0,5/1');
    expect(stakeLabel(cash({ sb: 2, bb: 5 }))).toBe('2/5');
  });
});

describe('tournament result', () => {
  it('counts every re-entry and add-on as cost', () => {
    const t = mtt({ entries: 3, addOns: [{ at: T0, amount: 50 }] });
    expect(tournamentCost(t)).toBe(350);
    expect(resultLocal(t)).toBe(-350);
  });
  it('adds prize and bounties', () => {
    const t = mtt({ entries: 2, prize: 1200, bountiesWon: 150 });
    expect(resultLocal(t)).toBe(1150);
  });
  it('finish percentile: winner 0, last 1', () => {
    expect(finishPercentile(mtt({ finish: 1, fieldSize: 101 }))).toBe(0);
    expect(finishPercentile(mtt({ finish: 101, fieldSize: 101 }))).toBe(1);
    expect(finishPercentile(mtt({ finish: 51, fieldSize: 101 }))).toBe(0.5);
    expect(finishPercentile(mtt({ finish: undefined, fieldSize: 101 }))).toBeUndefined();
  });
});

describe('parseAmount', () => {
  it.each([
    ['200', 200],
    ['1 234,50', 1234.5],
    ['1234.5', 1234.5],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['2,5k', 2500],
    ['€ 300', 300],
    ['', undefined],
    ['abc', undefined],
  ])('%s → %s', (raw, want) => {
    expect(parseAmount(raw)).toBe(want);
  });
});
