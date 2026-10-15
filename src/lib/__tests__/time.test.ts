import { formatAge, formatAgo, formatDuration, formatTimer } from '../time';

const now = new Date('2026-10-14T12:00:00');
const minus = (min: number) => new Date(now.getTime() - min * 60_000);

describe('formatAgo', () => {
  it.each([
    [0, 'Just now'],
    [35, '35 m ago'],
    [120, '2 h ago'],
    [135, '2 h 15 m ago'],
    [26 * 60, 'Yesterday'],
    [3 * 24 * 60, '3 days ago'],
  ])('%i minutes ago reads "%s"', (min, expected) => {
    expect(formatAgo(minus(min), now)).toBe(expected);
  });

  it('never goes negative for entries slightly in the future (clock skew)', () => {
    expect(formatAgo(new Date(now.getTime() + 30_000), now)).toBe('Just now');
  });
});

describe('formatTimer', () => {
  it('always shows hours so the chip width stays stable', () => {
    expect(formatTimer(new Date(now.getTime() - (42 * 60 + 18) * 1000), now)).toBe('0:42:18');
    expect(formatTimer(new Date(now.getTime() - (3600 + 5) * 1000), now)).toBe('1:00:05');
  });
});

describe('formatDuration', () => {
  it.each([
    [18, '18 min'],
    [60, '1 h'],
    [85, '1 h 25 m'],
    [680, '11 h 20 m'],
  ])('%i minutes reads "%s"', (min, expected) => {
    expect(formatDuration(min * 60_000)).toBe(expected);
  });
});

describe('formatAge', () => {
  it('reads in days, weeks, then months and weeks', () => {
    expect(formatAge(new Date('2026-10-09T12:00:00'), now)).toBe('5 days');
    expect(formatAge(new Date('2026-09-23T12:00:00'), now)).toBe('3 weeks');
    expect(formatAge(new Date('2026-05-31T12:00:00'), now)).toBe('4 months, 2 weeks');
    expect(formatAge(new Date('2026-08-14T12:00:00'), now)).toBe('2 months');
  });
});
