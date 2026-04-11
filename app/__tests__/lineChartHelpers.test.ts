/**
 * Tests for LineChart data processing logic.
 * These exercise the same algorithms used in app/components/LineChart.tsx
 * but as pure functions to verify correctness without native rendering.
 */
import { describe, it, expect } from 'vitest';

// ── Inlined from LineChart.tsx (pure functions) ────────────────────────

function niceScale(min: number, max: number, maxTicks = 5): number[] {
  if (min === max) return [min];
  const range = max - min;
  const roughStep = range / maxTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / mag;
  const niceStep =
    residual <= 1.5 ? mag : residual <= 3 ? 2 * mag : residual <= 7 ? 5 * mag : 10 * mag;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + niceStep * 0.001; t += niceStep) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  return ticks;
}

interface ChartDataPoint {
  date: number;
  [key: string]: number;
}

function cleanChartData(
  data: ChartDataPoint[],
  seriesKeys: string[],
): ChartDataPoint[] {
  return data
    .filter((point) =>
      seriesKeys.some((k) => {
        const v = point[k];
        return v !== undefined && v !== null && !Number.isNaN(v);
      }),
    )
    .sort((a, b) => a.date - b.date);
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('niceScale', () => {
  it('returns the value itself when min equals max', () => {
    expect(niceScale(5, 5)).toEqual([5]);
  });

  it('produces ticks that span the data range', () => {
    const ticks = niceScale(0, 10, 5);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]!).toBeGreaterThanOrEqual(10);
  });

  it('generates nice round numbers for typical weight ranges', () => {
    const ticks = niceScale(8.2, 12.5, 5);
    // All ticks should be nice round numbers
    for (const t of ticks) {
      expect(t % 1 === 0 || t % 0.5 === 0).toBe(true);
    }
  });

  it('handles very small ranges (behavioral 0-3 scale)', () => {
    const ticks = niceScale(0, 3, 5);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]!).toBeGreaterThanOrEqual(3);
  });

  it('handles negative range padding', () => {
    const ticks = niceScale(-0.5, 15.5, 5);
    expect(ticks[0]).toBeLessThanOrEqual(-0.5);
    expect(ticks[ticks.length - 1]!).toBeGreaterThanOrEqual(15.5);
  });
});

describe('cleanChartData', () => {
  it('filters out points with no valid values for any series key', () => {
    const data: ChartDataPoint[] = [
      { date: 1, value: 10 },
      { date: 2, value: NaN },
      { date: 3, value: 15 },
    ];
    const result = cleanChartData(data, ['value']);
    expect(result).toHaveLength(2);
    expect(result[0]!.date).toBe(1);
    expect(result[1]!.date).toBe(3);
  });

  it('keeps points that have at least one valid series value', () => {
    const data: ChartDataPoint[] = [
      { date: 1, catA: 10, catB: NaN },
      { date: 2, catA: NaN, catB: 5 },
      { date: 3, catA: NaN, catB: NaN },
    ];
    const result = cleanChartData(data, ['catA', 'catB']);
    expect(result).toHaveLength(2);
  });

  it('sorts by date ascending', () => {
    const data: ChartDataPoint[] = [
      { date: 3, value: 15 },
      { date: 1, value: 10 },
      { date: 2, value: 12 },
    ];
    const result = cleanChartData(data, ['value']);
    expect(result.map((p) => p.date)).toEqual([1, 2, 3]);
  });

  it('handles empty input', () => {
    expect(cleanChartData([], ['value'])).toEqual([]);
  });

  it('handles points with undefined values', () => {
    const data: ChartDataPoint[] = [
      { date: 1 } as ChartDataPoint, // no 'value' key
      { date: 2, value: 5 },
    ];
    const result = cleanChartData(data, ['value']);
    expect(result).toHaveLength(1);
    expect(result[0]!.date).toBe(2);
  });
});
