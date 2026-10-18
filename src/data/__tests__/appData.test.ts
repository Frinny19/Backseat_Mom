import { SyncEngine } from '@/sync/engine';
import { MemoryStore } from '@/sync/memoryStore';

import { AppData } from '../appData';

let clock = new Date('2026-10-15T08:00:00Z');
const tick = (min: number) => (clock = new Date(clock.getTime() + min * 60_000));

function setup() {
  let n = 0;
  const engine = new SyncEngine(new MemoryStore(), null, () => clock);
  return new AppData(engine, { userId: 'u1', familyId: 'f1' }, () => `id${++n}`, () => clock);
}

describe('AppData', () => {
  beforeEach(() => {
    clock = new Date('2026-10-15T08:00:00Z');
  });

  it('runs one timer per category, even if started twice', async () => {
    const data = setup();
    const a = await data.startTimer('b1', 'sleep', { kind: 'nap' });
    const b = await data.startTimer('b1', 'sleep', { kind: 'nap' });
    expect(b).toBe(a);
    tick(45);
    await data.stopTimer(a);
    expect((await data.entry(a))?.endedAt).toEqual(clock);
    expect(await data.running('b1', 'sleep')).toBeNull();
  });

  it('tracks breast sides and closes the last one on stop', async () => {
    const data = setup();
    const id = await data.startTimer('b1', 'feed', { kind: 'breast', segments: [{ side: 'left', startedAt: clock.toISOString() }] });
    tick(8);
    await data.switchSide(id, 'right');
    tick(6);
    await data.stopTimer(id);
    const d = (await data.entry(id))!.details as { segments: { side: string; endedAt?: string }[]; lastSide: string };
    expect(d.segments.map((s) => s.side)).toEqual(['left', 'right']);
    expect(d.segments.every((s) => s.endedAt)).toBe(true);
    expect(d.lastSide).toBe('right');
  });

  it('moves deleted entries to Recently deleted and back', async () => {
    const data = setup();
    const id = await data.logEntry({ babyId: 'b1', category: 'diaper', details: { kind: 'wet' }, startedAt: clock, endedAt: clock });
    await data.deleteEntry(id);
    expect((await data.recentlyDeleted()).map((e) => e.id)).toEqual([id]);
    await data.restoreEntry(id);
    expect(await data.recentlyDeleted()).toEqual([]);
    expect((await data.entry(id))?.deletedAt).toBeNull();
  });

  it('forgets deletions older than 30 days', async () => {
    const data = setup();
    const id = await data.logEntry({ babyId: 'b1', category: 'diaper', details: { kind: 'dirty' }, startedAt: clock, endedAt: clock });
    await data.deleteEntry(id);
    tick(31 * 24 * 60);
    expect(await data.recentlyDeleted()).toEqual([]);
  });

  it('validates details before saving', async () => {
    const data = setup();
    await expect(
      data.logEntry({ babyId: 'b1', category: 'med', details: { kind: 'dose', dose: -1, unit: 'ml' }, startedAt: clock, endedAt: clock }),
    ).rejects.toThrow();
  });

  it('stores ribbon prefs per baby', async () => {
    const data = setup();
    await data.setRibbonPrefs('b1', { hidden: ['pump'], order: ['sleep', 'feed'] });
    expect(await data.ribbonPrefs('b1')).toEqual({ hidden: ['pump'], order: ['sleep', 'feed'], due: {} });
    expect(await data.ribbonPrefs('b2')).toEqual({ hidden: [], order: [], due: {} });
  });
});
