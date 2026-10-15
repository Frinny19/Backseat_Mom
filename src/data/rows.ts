import { CATEGORIES, categoryFromDb, DB_CATEGORY, type Category } from '@/domain/categories';
import type { Entry } from '@/domain/entries';
import type { RibbonPrefs } from '@/domain/ribbon';
import type { Row } from '@/sync/types';

/** Converts between rows as Postgres stores them and the app's domain types. */

export function rowToEntry(r: Row): Entry {
  return {
    id: r.id,
    babyId: r.baby_id as string,
    category: categoryFromDb(r.category as string),
    startedAt: new Date(r.started_at as string),
    endedAt: r.ended_at ? new Date(r.ended_at as string) : null,
    details: r.details as Entry['details'],
    note: (r.note as string | null) ?? null,
    medicationId: (r.medication_id as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    updatedBy: (r.updated_by as string | null) ?? null,
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
  } as Entry;
}

export function entryToRow(e: Entry, familyId: string): Row {
  return {
    id: e.id,
    family_id: familyId,
    baby_id: e.babyId,
    category: DB_CATEGORY[e.category],
    kind: (e.details as { kind: string }).kind,
    started_at: e.startedAt.toISOString(),
    ended_at: e.endedAt ? e.endedAt.toISOString() : null,
    details: e.details,
    note: e.note ?? null,
    medication_id: e.medicationId ?? null,
    created_by: e.createdBy ?? null,
    updated_by: e.updatedBy ?? null,
    deleted_at: e.deletedAt ? e.deletedAt.toISOString() : null,
  };
}

export type Medication = {
  id: string;
  babyId: string;
  name: string;
  defaultDose: number | null;
  unit: string | null;
  minIntervalHours: number | null;
  maxDosesPerDay: number | null;
  active: boolean;
};

export function rowToMedication(r: Row): Medication {
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  return {
    id: r.id,
    babyId: r.baby_id as string,
    name: r.name as string,
    defaultDose: num(r.default_dose),
    unit: (r.unit as string | null) ?? null,
    minIntervalHours: num(r.min_interval_hours),
    maxDosesPerDay: num(r.max_doses_per_day),
    active: r.active !== false,
  };
}

const isCategory = (c: unknown): c is Category => CATEGORIES.includes(c as Category);

export function rowToPrefs(r: Row | null): RibbonPrefs {
  return {
    hidden: ((r?.hidden as string[] | undefined) ?? []).filter(isCategory),
    order: ((r?.order as string[] | undefined) ?? []).filter(isCategory),
  };
}

export type Member = { userId: string; name: string; role: 'owner' | 'caregiver' | 'viewer'; joinedAt: Date };
