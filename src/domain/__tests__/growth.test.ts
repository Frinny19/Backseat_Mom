import { formatPercentile, percentile, valueAtZ, zScore } from '../growth';

const birth = new Date('2026-01-01T00:00:00Z');
const days = (n: number) => new Date(birth.getTime() + n * 24 * 3600_000);

describe('WHO growth', () => {
  it('puts the WHO median at the 50th percentile', () => {
    expect(percentile('weight', 'male', birth, birth, 3.3464)).toBeCloseTo(50, 1);
    expect(valueAtZ('weight', 'female', 364, 0)).toBeCloseTo(8.9388, 3);
  });

  it('round-trips z-scores', () => {
    const v = valueAtZ('length', 'male', 100, 1.5)!;
    expect(zScore('length', 'male', 100, v)).toBeCloseTo(1.5, 6);
  });

  it('matches WHO: a 6-month boy at 7.9 kg is about the median', () => {
    expect(percentile('weight', 'male', birth, days(182), 7.9)!).toBeGreaterThan(45);
    expect(percentile('weight', 'male', birth, days(182), 7.9)!).toBeLessThan(55);
  });

  it('has no percentile past two years', () => {
    expect(percentile('weight', 'female', birth, days(800), 12)).toBeNull();
  });

  it('formats ordinals', () => {
    expect(['1', '2', '3', '11', '12', '22', '50'].map((n) => formatPercentile(Number(n)))).toEqual([
      '1st',
      '2nd',
      '3rd',
      '11th',
      '12th',
      '22nd',
      '50th',
    ]);
    expect(formatPercentile(0.4)).toBe('below the 1st');
  });
});
