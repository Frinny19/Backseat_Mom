import type { Entry } from '@/domain/entries';
import type { LocalStore } from '@/sync/types';

import { entryToRow } from './rows';

export const DEMO_BABY = { id: 'demo-baby', name: 'Mila', birthDate: monthsAgo(4, 14) };

function monthsAgo(months: number, extraDays: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - extraDays);
  return d;
}

const ago = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000);

/** A believable morning, relative to `now`, so the ribbon and timeline have something to show. */
export function demoEntries(now: Date): Entry[] {
  const b = DEMO_BABY.id;
  return [
    { id: 'd1', babyId: b, category: 'sleep', startedAt: ago(now, 42), endedAt: null, details: { kind: 'nap', place: 'crib' }, note: 'In the crib', createdBy: 'Sam' },
    { id: 'd2', babyId: b, category: 'diaper', startedAt: ago(now, 35), endedAt: ago(now, 35), details: { kind: 'wet' }, createdBy: 'Sam' },
    { id: 'd3', babyId: b, category: 'feed', startedAt: ago(now, 153), endedAt: ago(now, 135), details: { kind: 'breast', segments: [], lastSide: 'left' }, createdBy: 'Frin' },
    { id: 'd4', babyId: b, category: 'diaper', startedAt: ago(now, 170), endedAt: ago(now, 170), details: { kind: 'wet' }, createdBy: 'Frin' },
    { id: 'd5', babyId: b, category: 'med', startedAt: ago(now, 180), endedAt: ago(now, 180), details: { kind: 'dose', dose: 2.5, unit: 'ml', reason: 'Teething' }, medicationId: 'demo-tylenol', createdBy: 'Sam' },
    { id: 'd6', babyId: b, category: 'pump', startedAt: ago(now, 240), endedAt: ago(now, 220), details: { kind: 'double', left: 70, right: 70, total: 140, unit: 'ml' }, createdBy: 'Frin' },
    { id: 'd7', babyId: b, category: 'feed', startedAt: ago(now, 330), endedAt: ago(now, 320), details: { kind: 'bottle', amount: 120, unit: 'ml', milk: 'breast_milk' }, createdBy: 'Sam' },
    { id: 'd8', babyId: b, category: 'milestone', startedAt: ago(now, 3 * 24 * 60), endedAt: ago(now, 3 * 24 * 60), details: { kind: 'first', title: 'First smile' }, createdBy: 'Frin' },
  ];
}

export const DEMO_CONTEXT = { userId: 'Frin', familyId: 'demo-family' };

/** Fills an empty store with the demo family, so logging works without Supabase. */
export async function seedDemo(store: LocalStore, now: Date) {

  for (const e of demoEntries(now)) await store.put('entries', entryToRow(e, DEMO_CONTEXT.familyId));
  await store.put('medications', {
    id: 'demo-tylenol',
    family_id: DEMO_CONTEXT.familyId,
    baby_id: DEMO_BABY.id,
    name: 'Tylenol',
    default_dose: 2.5,
    unit: 'ml',
    min_interval_hours: 4,
    max_doses_per_day: 5,
    active: true,
  });
  for (const [id, name, role] of [['Frin', 'Frin', 'owner'], ['Sam', 'Sam', 'caregiver']] as const) {
    await store.put('profiles', { id, display_name: name });
    await store.put('family_members', {
      id: `${DEMO_CONTEXT.familyId}:${id}`,
      family_id: DEMO_CONTEXT.familyId,
      user_id: id,
      role,
      joined_at: now.toISOString(),
    });
  }
}
