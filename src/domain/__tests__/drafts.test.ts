import type { Entry } from '../entries';
import { draftDetails, draftEnd, draftProblem, entryToDraft, newDraft } from '../drafts';
import { describeChange } from '../history';
import { doseWarning } from '../meds';
import { sideTotals } from '../timeline';

const now = new Date('2026-10-15T10:00:00');
const minAgo = (m: number) => new Date(now.getTime() - m * 60_000);

function entry(partial: Partial<Entry> & Pick<Entry, 'category' | 'details'>): Entry {
  return { id: 'e1', babyId: 'b', startedAt: minAgo(30), endedAt: minAgo(10), ...partial } as Entry;
}

describe('drafts', () => {
  it('starts a breastfeed on the other side from last time', () => {
    const last = entry({ category: 'feed', details: { kind: 'breast', segments: [], lastSide: 'left' } });
    expect(newDraft('feed', now, last).side).toBe('right');
  });

  it('remembers the last bottle amount and the last medication', () => {
    const bottle = entry({ category: 'feed', details: { kind: 'bottle', amount: 150, unit: 'ml' } });
    expect(newDraft('feed', now, bottle)).toMatchObject({ feedKind: 'bottle', amount: 150 });
    const dose = entry({ category: 'med', details: { kind: 'dose', dose: 5, unit: 'ml' }, medicationId: 'tylenol' });
    expect(newDraft('med', now, dose)).toMatchObject({ medicationId: 'tylenol', dose: 5 });
  });

  it('turns a pump draft into details with a total', () => {
    const d = { ...newDraft('pump', now), left: 50, right: 70, use: 'stored' as const, storage: 'freezer' as const };
    expect(draftDetails(d)).toEqual({ kind: 'double', left: 50, right: 70, total: 120, unit: 'ml', use: 'stored', storage: 'freezer' });
  });

  it('only keeps colour and texture for dirty diapers', () => {
    const wet = { ...newDraft('diaper', now), diaperKind: 'wet' as const, colour: 'green' as const };
    expect(draftDetails(wet)).toEqual({ kind: 'wet' });
    const dirty = { ...wet, diaperKind: 'dirty' as const, consistency: 'seedy' as const };
    expect(draftDetails(dirty)).toEqual({ kind: 'dirty', colour: 'green', consistency: 'seedy' });
  });

  it('keeps timer segments when a breastfeed is edited', () => {
    const segments = [{ side: 'left', startedAt: minAgo(30).toISOString(), endedAt: minAgo(10).toISOString() }];
    const e = entry({ category: 'feed', details: { kind: 'breast', segments, lastSide: 'left' } as never });
    const d = entryToDraft(e);
    expect(d.durationMin).toBe(20);
    expect(draftDetails(d, e.details)).toMatchObject({ kind: 'breast', segments });
    expect(draftEnd(d, true)).toEqual(minAgo(10));
  });

  it('round-trips a growth measurement', () => {
    const e = entry({ category: 'milestone', details: { kind: 'growth', weightKg: 6.4, lengthCm: 62 } });
    expect(draftDetails(entryToDraft(e))).toEqual({ kind: 'growth', weightKg: 6.4, lengthCm: 62 });
  });

  it('explains what is missing', () => {
    expect(draftProblem(newDraft('med', now))).toBe('Pick a medication');
    expect(draftProblem(newDraft('milestone', now))).toBe('Give the milestone a name');
    expect(draftProblem({ ...newDraft('milestone', now), milestoneKind: 'growth' })).toBe('Enter at least one measurement');
    expect(draftProblem(newDraft('diaper', now))).toBeNull();
  });

  it('ends point events when they start', () => {
    const d = newDraft('diaper', now);
    expect(draftEnd(d, false)).toEqual(now);
  });
});

describe('doseWarning', () => {
  const med = { id: 'm', name: 'Tylenol', minIntervalHours: 4, maxDosesPerDay: 3 };
  const dose = (minutes: number, id = String(minutes)) =>
    entry({ id, category: 'med', details: { kind: 'dose', dose: 2.5, unit: 'ml' }, medicationId: 'm', startedAt: minAgo(minutes), endedAt: minAgo(minutes) });

  it('warns when the last dose was too recent', () => {
    expect(doseWarning(med, [dose(120)], now)).toMatchObject({ level: 'early', message: expect.stringMatching(/^Last Tylenol was 2 h ago/) });
  });

  it('is quiet once the gap has passed', () => {
    expect(doseWarning(med, [dose(300)], now)).toBeNull();
  });

  it('warns at the daily limit', () => {
    expect(doseWarning(med, [dose(300), dose(600), dose(900)], now)).toMatchObject({ level: 'max', message: expect.stringMatching(/3 doses/) });
  });

  it('ignores deleted doses', () => {
    expect(doseWarning(med, [{ ...dose(60), deletedAt: now }], now)).toBeNull();
  });
});

describe('sideTotals', () => {
  it('adds the open side up to now', () => {
    const details = {
      segments: [
        { side: 'left', startedAt: minAgo(20).toISOString(), endedAt: minAgo(12).toISOString() },
        { side: 'right', startedAt: minAgo(12).toISOString() },
      ],
    };
    expect(sideTotals(details, now)).toEqual({ left: 8 * 60_000, right: 12 * 60_000, current: 'right' });
  });
});

describe('describeChange', () => {
  const base = { id: 'h', changedBy: null, changedAt: now };
  it('names the fields that changed', () => {
    expect(
      describeChange({ ...base, op: 'update', before: { note: null, started_at: 'a' }, after: { note: 'x', started_at: 'b' } }),
    ).toBe('Changed start time and note');
  });
  it('recognises a stopped timer', () => {
    expect(describeChange({ ...base, op: 'update', before: { ended_at: null }, after: { ended_at: 'z' } })).toBe('Stopped the timer');
  });
  it('labels deletes and restores', () => {
    expect(describeChange({ ...base, op: 'delete', before: null, after: null })).toBe('Deleted');
    expect(describeChange({ ...base, op: 'restore', before: null, after: null })).toBe('Restored');
  });
});
