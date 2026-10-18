import { CATEGORY_INFO, type Category } from '@/domain/categories';
import type { DetailsFor, Entry } from '@/domain/entries';
import { detailsSchema } from '@/domain/entries';
import type { RibbonPrefs } from '@/domain/ribbon';
import type { SyncEngine } from '@/sync/engine';
import type { Row } from '@/sync/types';

import { entryToRow, rowToEntry, rowToMedication, rowToPrefs, type Medication, type Member } from './rows';

export type DataContext = { userId: string; familyId: string };

/** Everything the screens read and write, on top of the sync engine. */
export class AppData {
  constructor(
    readonly engine: SyncEngine,
    readonly ctx: DataContext,
    private newId: () => string,
    private now: () => Date = () => new Date(),
  ) {}

  private get local() {
    return this.engine.local;
  }

  // -- Entries ---------------------------------------------------------------

  /** Entries for a baby from the last `days` days, including ones in Recently deleted. */
  async entries(babyId: string, days = 35): Promise<Entry[]> {
    const since = new Date(this.now().getTime() - days * 24 * 3600_000).toISOString();
    const rows = await this.local.entriesForBaby(babyId, since);
    return rows.map(rowToEntry).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /** Every milestone and growth measurement for a baby, oldest first. They don't age out like the daily log. */
  async milestones(babyId: string): Promise<Entry<'milestone'>[]> {
    const rows = await this.local.entriesForBaby(babyId, new Date(0).toISOString());
    return rows
      .map(rowToEntry)
      .filter((e): e is Entry<'milestone'> => e.category === 'milestone' && !e.deletedAt)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }

  async entry(id: string): Promise<Entry | null> {
    const r = await this.local.get('entries', id);
    return r ? rowToEntry(r) : null;
  }

  async logEntry<C extends Category>(input: {
    babyId: string;
    category: C;
    details: DetailsFor<C>;
    startedAt: Date;
    endedAt: Date | null;
    note?: string | null;
    medicationId?: string | null;
  }): Promise<string> {
    const details = detailsSchema[input.category].parse(input.details) as DetailsFor<C>;
    const entry = {
      id: this.newId(),
      babyId: input.babyId,
      category: input.category,
      details,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      note: input.note?.trim() || null,
      medicationId: input.medicationId ?? null,
      createdBy: this.ctx.userId,
      updatedBy: this.ctx.userId,
      deletedAt: null,
    } as Entry;
    await this.engine.insert('entries', entryToRow(entry, this.ctx.familyId));
    return entry.id;
  }

  /** The running timer for a category, if any. */
  async running(babyId: string, category: Category): Promise<Entry | null> {
    const recent = await this.entries(babyId, 3);
    return recent.find((e) => e.category === category && e.endedAt === null && !e.deletedAt) ?? null;
  }

  /**
   * Starts a timer. If one is already running for this category (perhaps started
   * on another phone), returns that one instead of starting a second.
   */
  async startTimer<C extends Category>(babyId: string, category: C, details: DetailsFor<C>, startedAt = this.now()) {
    if (!CATEGORY_INFO[category].timed) throw new Error(`${category} has no timer`);
    const existing = await this.running(babyId, category);
    if (existing) return existing.id;
    return this.logEntry({ babyId, category, details, startedAt, endedAt: null });
  }

  async stopTimer(id: string, endedAt = this.now()) {
    const e = await this.entry(id);
    if (!e || e.endedAt) return;
    const fields: Record<string, unknown> = { ended_at: endedAt.toISOString() };
    const d = e.details as { kind: string; segments?: { side: string; startedAt: string; endedAt?: string }[] };
    if (e.category === 'feed' && d.kind === 'breast' && d.segments?.length) {
      const segments = closeSegments(d.segments, endedAt);
      fields.details = { ...d, segments, lastSide: segments[segments.length - 1].side };
    }
    await this.engine.patch('entries', id, fields);
  }

  /** Breastfeeding: close the current side and start the other. */
  async switchSide(id: string, side: 'left' | 'right', at = this.now()) {
    const e = await this.entry(id);
    if (!e || e.category !== 'feed') return;
    const d = e.details as { kind: string; segments?: { side: string; startedAt: string; endedAt?: string }[] };
    const segments = closeSegments(d.segments ?? [], at);
    segments.push({ side, startedAt: at.toISOString() });
    await this.engine.patch('entries', id, { details: { ...d, segments, lastSide: side } });
  }

  async updateEntry(
    id: string,
    changes: Partial<Pick<Entry, 'startedAt' | 'endedAt' | 'note' | 'medicationId'>> & { details?: unknown },
  ) {
    const e = await this.entry(id);
    if (!e) return;
    const fields: Record<string, unknown> = {};
    if (changes.startedAt) fields.started_at = changes.startedAt.toISOString();
    if (changes.endedAt !== undefined) fields.ended_at = changes.endedAt ? changes.endedAt.toISOString() : null;
    if (changes.note !== undefined) fields.note = changes.note?.trim() || null;
    if (changes.medicationId !== undefined) fields.medication_id = changes.medicationId;
    if (changes.details !== undefined) {
      const details = detailsSchema[e.category].parse(changes.details) as { kind: string };
      fields.details = details;
      fields.kind = details.kind;
    }
    if (Object.keys(fields).length) await this.engine.patch('entries', id, fields);
  }

  /** Moves an entry to Recently deleted, where anyone in the family can restore it for 30 days. */
  async deleteEntry(id: string) {
    await this.engine.patch('entries', id, { deleted_at: this.now().toISOString() });
  }

  async restoreEntry(id: string) {
    await this.engine.patch('entries', id, { deleted_at: null });
  }

  /** Entries deleted in the last 30 days, across all babies, newest deletion first. */
  async recentlyDeleted(): Promise<Entry[]> {
    const cutoff = this.now().getTime() - 30 * 24 * 3600_000;
    return (await this.local.all('entries'))
      .map(rowToEntry)
      .filter((e) => e.deletedAt && e.deletedAt.getTime() >= cutoff)
      .sort((a, b) => b.deletedAt!.getTime() - a.deletedAt!.getTime());
  }

  // -- Medications -----------------------------------------------------------

  async medications(babyId: string): Promise<Medication[]> {
    return (await this.local.all('medications'))
      .filter((r) => r.baby_id === babyId)
      .map(rowToMedication)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async addMedication(input: Omit<Medication, 'id' | 'active'>): Promise<string> {
    const id = this.newId();
    await this.engine.insert('medications', {
      id,
      family_id: this.ctx.familyId,
      baby_id: input.babyId,
      name: input.name.trim(),
      default_dose: input.defaultDose,
      unit: input.unit,
      min_interval_hours: input.minIntervalHours,
      max_doses_per_day: input.maxDosesPerDay,
      active: true,
    });
    return id;
  }

  async updateMedication(id: string, changes: Partial<Omit<Medication, 'id' | 'babyId'>>) {
    const map: Record<string, string> = {
      name: 'name',
      defaultDose: 'default_dose',
      unit: 'unit',
      minIntervalHours: 'min_interval_hours',
      maxDosesPerDay: 'max_doses_per_day',
      active: 'active',
    };
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changes)) if (map[k]) fields[map[k]] = v;
    if (Object.keys(fields).length) await this.engine.patch('medications', id, fields);
  }

  // -- Ribbon prefs ----------------------------------------------------------

  async ribbonPrefs(babyId: string): Promise<RibbonPrefs> {
    return rowToPrefs(await this.local.get('ribbon_prefs', babyId));
  }

  async setRibbonPrefs(babyId: string, prefs: RibbonPrefs) {
    const current = await this.local.get('ribbon_prefs', babyId);
    const row: Row = {
      id: babyId,
      user_id: this.ctx.userId,
      baby_id: babyId,
      hidden: prefs.hidden,
      order: prefs.order,
      due_intervals: prefs.due ?? (current?.due_intervals as object | undefined) ?? {},
    };
    await this.engine.upsert('ribbon_prefs', row);
  }

  // -- People ----------------------------------------------------------------

  async members(): Promise<Member[]> {
    const profiles = new Map((await this.local.all('profiles')).map((p) => [p.id, p]));
    return (await this.local.all('family_members'))
      .filter((m) => m.family_id === this.ctx.familyId)
      .map((m) => ({
        userId: m.user_id as string,
        name: (profiles.get(m.user_id as string)?.display_name as string | undefined) || 'Someone',
        role: m.role as Member['role'],
        joinedAt: new Date(m.joined_at as string),
      }))
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  }

  /** Display names by user id, for "by Sam" on the timeline. */
  async names(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const p of await this.local.all('profiles')) out[p.id] = (p.display_name as string) || 'Someone';
    return out;
  }
}

function closeSegments<T extends { side: string; startedAt: string; endedAt?: string }>(segments: T[], at: Date): T[] {
  return segments.map((s) => (s.endedAt ? s : { ...s, endedAt: at.toISOString() }));
}

