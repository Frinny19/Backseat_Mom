import { buildRibbon, DEFAULT_RIBBON_PREFS, visibleCategories } from '../ribbon';
import type { Entry } from '../entries';

const now = new Date('2026-10-14T12:00:00');
const minus = (min: number) => new Date(now.getTime() - min * 60_000);

function entry(partial: Partial<Entry> & Pick<Entry, 'category' | 'details'>): Entry {
  return { id: Math.random().toString(36), babyId: 'b', startedAt: minus(10), endedAt: minus(10), ...partial } as Entry;
}

describe('visibleCategories', () => {
  it('shows all six in the default order', () => {
    expect(visibleCategories(DEFAULT_RIBBON_PREFS)).toEqual(['feed', 'pump', 'sleep', 'diaper', 'med', 'milestone']);
  });

  it('follows the person\'s order, appends missing categories and drops hidden ones', () => {
    expect(visibleCategories({ order: ['diaper', 'feed'], hidden: ['pump', 'milestone'] })).toEqual([
      'diaper',
      'feed',
      'sleep',
      'med',
    ]);
  });
});

describe('buildRibbon', () => {
  it('reads "Never" for a category with no entries', () => {
    const [feed] = buildRibbon([], DEFAULT_RIBBON_PREFS, now);
    expect(feed).toMatchObject({ activity: 'feed', time: 'Never', never: true });
  });

  it('shows time since the latest entry and the detail that drives the next decision', () => {
    const items = buildRibbon(
      [
        entry({ category: 'feed', startedAt: minus(300), details: { kind: 'bottle', amount: 90, unit: 'ml' } }),
        entry({ category: 'feed', startedAt: minus(135), endedAt: minus(120), details: { kind: 'breast', segments: [], lastSide: 'left' } }),
        entry({ category: 'diaper', startedAt: minus(35), details: { kind: 'wet' } }),
      ],
      DEFAULT_RIBBON_PREFS,
      now,
    );
    expect(items.find((i) => i.activity === 'feed')).toMatchObject({ time: '2 h 15 m ago', detail: 'Left side' });
    expect(items.find((i) => i.activity === 'diaper')).toMatchObject({ time: '35 m ago', detail: 'Wet' });
  });

  it('turns a running sleep into a live timer', () => {
    const items = buildRibbon(
      [entry({ category: 'sleep', startedAt: new Date(now.getTime() - 2538_000), endedAt: null, details: { kind: 'nap' } })],
      DEFAULT_RIBBON_PREFS,
      now,
    );
    expect(items.find((i) => i.activity === 'sleep')).toMatchObject({ label: 'Napping', time: '0:42:18', active: true });
  });

  it('can show two running timers at once', () => {
    const items = buildRibbon(
      [
        entry({ category: 'sleep', startedAt: minus(20), endedAt: null, details: { kind: 'nap' } }),
        entry({ category: 'pump', startedAt: minus(5), endedAt: null, details: { kind: 'double', unit: 'ml' } }),
      ],
      DEFAULT_RIBBON_PREFS,
      now,
    );
    expect(items.filter((i) => i.active).map((i) => i.activity)).toEqual(['pump', 'sleep']);
  });

  it('counts sleep from waking up', () => {
    const items = buildRibbon(
      [entry({ category: 'sleep', startedAt: minus(200), endedAt: minus(100), details: { kind: 'nap' } })],
      DEFAULT_RIBBON_PREFS,
      now,
    );
    expect(items.find((i) => i.activity === 'sleep')?.time).toBe('1 h 40 m ago');
  });

  it('ignores deleted entries', () => {
    const items = buildRibbon(
      [entry({ category: 'diaper', details: { kind: 'dirty' }, deletedAt: minus(1) })],
      DEFAULT_RIBBON_PREFS,
      now,
    );
    expect(items.find((i) => i.activity === 'diaper')?.never).toBe(true);
  });

  it('names the medication', () => {
    const items = buildRibbon(
      [entry({ category: 'med', startedAt: minus(180), medicationId: 'm1', details: { kind: 'dose', dose: 2.5, unit: 'ml' } })],
      DEFAULT_RIBBON_PREFS,
      now,
      { m1: 'Tylenol' },
    );
    expect(items.find((i) => i.activity === 'med')).toMatchObject({ label: 'Tylenol', time: '3 h ago' });
  });

  it('leaves hidden categories out', () => {
    const items = buildRibbon([], { order: [], hidden: ['pump', 'med'] }, now);
    expect(items.map((i) => i.activity)).toEqual(['feed', 'sleep', 'diaper', 'milestone']);
  });
});
