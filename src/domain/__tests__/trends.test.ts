import type { Entry } from '../entries';
import { average, dailyTotals } from '../trends';

const now = new Date('2026-10-15T12:00:00');
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);

function e(p: Partial<Entry> & Pick<Entry, 'category' | 'details' | 'startedAt'>): Entry {
  return { id: Math.random().toString(36), babyId: 'b', endedAt: p.startedAt, ...p } as Entry;
}

describe('dailyTotals', () => {
  it('counts each day separately, oldest first', () => {
    const t = dailyTotals(
      [
        e({ category: 'feed', details: { kind: 'bottle', amount: 4, unit: 'oz' }, startedAt: at(14, 9) }),
        e({ category: 'feed', details: { kind: 'bottle', amount: 120, unit: 'ml' }, startedAt: at(15, 8) }),
        e({ category: 'diaper', details: { kind: 'mixed' }, startedAt: at(15, 9) }),
        e({ category: 'pump', details: { kind: 'double', left: 60, right: 50, total: 110, unit: 'ml' }, startedAt: at(15, 7) }),
      ],
      now,
      3,
    );
    expect(t.map((d) => d.day.getDate())).toEqual([13, 14, 15]);
    expect(t[1]).toMatchObject({ feeds: 1, milkMl: 118 });
    expect(t[2]).toMatchObject({ feeds: 1, milkMl: 120, diapers: 1, wet: 1, dirty: 1, pumpMl: 110 });
  });

  it('splits night sleep across midnight and counts a running nap up to now', () => {
    const t = dailyTotals(
      [
        e({ category: 'sleep', details: { kind: 'night' }, startedAt: at(14, 22), endedAt: at(15, 6) }),
        e({ category: 'sleep', details: { kind: 'nap' }, startedAt: at(15, 11), endedAt: null }),
      ],
      now,
      2,
    );
    expect(t[0].sleepMs).toBe(2 * 3600_000);
    expect(t[1].sleepMs).toBe(7 * 3600_000);
  });

  it('ignores deleted entries', () => {
    const t = dailyTotals([e({ category: 'diaper', details: { kind: 'wet' }, startedAt: at(15, 9), deletedAt: now })], now, 1);
    expect(t[0].diapers).toBe(0);
  });

  it('averages the finished days only', () => {
    const t = dailyTotals([e({ category: 'diaper', details: { kind: 'wet' }, startedAt: at(14, 9) })], now, 3);
    expect(average(t, (d) => d.diapers)).toBe(0.5);
  });
});
