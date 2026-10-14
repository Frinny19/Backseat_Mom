import type { Entry } from '../entries';
import { entryTitle, quickLogHint, todaysEntries, todayTotals } from '../timeline';

const now = new Date('2026-10-14T12:00:00');
const at = (hhmm: string, day = '2026-10-14') => new Date(`${day}T${hhmm}:00`);
const e = (p: Partial<Entry> & Pick<Entry, 'category' | 'details'>): Entry =>
  ({ id: Math.random().toString(36), babyId: 'b', startedAt: at('09:00'), endedAt: at('09:00'), ...p }) as Entry;

describe('entryTitle', () => {
  it('states the what and the amount', () => {
    expect(entryTitle(e({ category: 'feed', details: { kind: 'bottle', amount: 120, unit: 'ml' } }))).toBe('Bottle · 120 ml');
    expect(entryTitle(e({ category: 'sleep', startedAt: at('09:00'), endedAt: at('10:25'), details: { kind: 'nap' } }))).toBe('Nap · 1 h 25 m');
    expect(entryTitle(e({ category: 'diaper', details: { kind: 'wet' } }))).toBe('Diaper · wet');
    expect(entryTitle(e({ category: 'med', details: { kind: 'dose', dose: 2.5, unit: 'ml' } }), 'Tylenol')).toBe('Tylenol · 2.5 ml');
  });

  it('says when a running timer started', () => {
    expect(entryTitle(e({ category: 'sleep', endedAt: null, details: { kind: 'nap' } }))).toMatch(/^Nap · started /);
  });
});

describe('todayTotals', () => {
  it('adds up milk, sleep since midnight and diapers', () => {
    const totals = todayTotals(
      [
        e({ category: 'feed', details: { kind: 'bottle', amount: 120, unit: 'ml' } }),
        e({ category: 'feed', details: { kind: 'bottle', amount: 4, unit: 'oz' } }),
        e({ category: 'feed', startedAt: at('20:00', '2026-10-13'), details: { kind: 'bottle', amount: 999, unit: 'ml' } }),
        // Night sleep from 21:00 yesterday to 06:00 counts 6 h today.
        e({ category: 'sleep', startedAt: at('21:00', '2026-10-13'), endedAt: at('06:00'), details: { kind: 'night' } }),
        // A nap running since 11:30 counts 30 min so far.
        e({ category: 'sleep', startedAt: at('11:30'), endedAt: null, details: { kind: 'nap' } }),
        e({ category: 'diaper', details: { kind: 'wet' } }),
        e({ category: 'diaper', details: { kind: 'dirty' } }),
        e({ category: 'diaper', details: { kind: 'mixed' }, deletedAt: now }),
      ],
      now,
    );
    expect(totals).toEqual({ milkMl: 238, feeds: 2, sleepMs: 6.5 * 3600_000, diapers: 2, wetDiapers: 1 });
  });
});

describe('todaysEntries', () => {
  it('keeps today\'s live entries, newest first', () => {
    const list = todaysEntries(
      [
        e({ id: 'a', category: 'diaper', startedAt: at('08:00'), details: { kind: 'wet' } }),
        e({ id: 'b', category: 'diaper', startedAt: at('10:00'), details: { kind: 'wet' } }),
        e({ id: 'c', category: 'diaper', startedAt: at('23:00', '2026-10-13'), details: { kind: 'wet' } }),
        e({ id: 'd', category: 'diaper', startedAt: at('11:00'), details: { kind: 'wet' }, deletedAt: now }),
      ],
      now,
    );
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('quickLogHint', () => {
  it('suggests the other breast next', () => {
    const entries = [
      e({ category: 'feed', startedAt: at('07:00'), details: { kind: 'breast', segments: [], lastSide: 'right' } }),
      e({ category: 'feed', startedAt: at('10:00'), details: { kind: 'breast', segments: [], lastSide: 'left' } }),
    ];
    expect(quickLogHint('feed', entries, now)).toBe('Right next');
  });
});
