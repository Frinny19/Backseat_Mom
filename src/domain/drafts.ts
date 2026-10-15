import type { Category } from './categories';
import type { DetailsFor, Entry } from './entries';
import { detailsSchema } from './entries';

/**
 * What a log sheet is editing. One flat shape for every category keeps the
 * sheet's state simple; `draftToEntry` turns it into the entry's `details`.
 */
export type Draft = {
  category: Category;
  startedAt: Date;
  /** Minutes, for timed categories logged after the fact. 0 means "no end time". */
  durationMin: number;
  note: string;

  feedKind: 'breast' | 'bottle' | 'solids';
  side: 'left' | 'right';
  amount: number;
  unit: 'ml' | 'oz';
  milk: 'breast_milk' | 'formula' | null;
  foods: string;

  pumpKind: 'single' | 'double';
  left: number;
  right: number;
  use: 'stored' | 'used' | null;
  storage: 'fridge' | 'freezer' | null;

  sleepKind: 'nap' | 'night';
  place: DetailsFor<'sleep'>['place'] | null;

  diaperKind: DetailsFor<'diaper'>['kind'];
  colour: DetailsFor<'diaper'>['colour'] | null;
  consistency: DetailsFor<'diaper'>['consistency'] | null;
  rash: boolean;

  medicationId: string | null;
  dose: number;
  doseUnit: string;
  reason: string;
  temperatureC: number | null;

  milestoneKind: 'developmental' | 'first' | 'growth';
  title: string;
  weightKg: number | null;
  lengthCm: number | null;
  headCm: number | null;
};

const DEFAULT_DURATION: Record<Category, number> = { feed: 15, pump: 15, sleep: 60, diaper: 0, med: 0, milestone: 0 };

/** A fresh draft, pre-filled from the last entry of the same category where that saves taps. */
export function newDraft(category: Category, now: Date, last?: Entry | null): Draft {
  const d: Draft = {
    category,
    startedAt: now,
    durationMin: DEFAULT_DURATION[category],
    note: '',
    feedKind: 'breast',
    side: 'left',
    amount: 90,
    unit: 'ml',
    milk: null,
    foods: '',
    pumpKind: 'double',
    left: 60,
    right: 60,
    use: null,
    storage: null,
    sleepKind: now.getHours() >= 19 || now.getHours() < 6 ? 'night' : 'nap',
    place: null,
    diaperKind: 'wet',
    colour: null,
    consistency: null,
    rash: false,
    medicationId: null,
    dose: 2.5,
    doseUnit: 'ml',
    reason: '',
    temperatureC: null,
    milestoneKind: 'first',
    title: '',
    weightKg: null,
    lengthCm: null,
    headCm: null,
  };
  if (!last || last.category !== category) return d;
  const x = last.details as Record<string, unknown>;
  switch (category) {
    case 'feed':
      d.feedKind = x.kind as Draft['feedKind'];
      if (x.kind === 'breast') {
        // Start on the other side from last time.
        const lastSide = (x.lastSide as Draft['side'] | undefined) ?? lastSegmentSide(x);
        d.side = lastSide === 'left' ? 'right' : 'left';
      }
      if (x.kind === 'bottle') {
        d.amount = (x.amount as number | undefined) ?? d.amount;
        d.unit = (x.unit as Draft['unit']) ?? 'ml';
        d.milk = (x.milk as Draft['milk']) ?? null;
      }
      break;
    case 'pump':
      d.pumpKind = x.kind as Draft['pumpKind'];
      d.unit = (x.unit as Draft['unit']) ?? 'ml';
      d.left = (x.left as number | undefined) ?? d.left;
      d.right = (x.right as number | undefined) ?? d.right;
      break;
    case 'med':
      d.medicationId = last.medicationId ?? null;
      d.dose = (x.dose as number) ?? d.dose;
      d.doseUnit = (x.unit as string) ?? d.doseUnit;
      break;
  }
  return d;
}

function lastSegmentSide(x: Record<string, unknown>): Draft['side'] | undefined {
  const segs = x.segments as { side: Draft['side'] }[] | undefined;
  return segs?.length ? segs[segs.length - 1].side : undefined;
}

/** Loads an existing entry into a draft, for editing. */
export function entryToDraft(e: Entry): Draft {
  const d = newDraft(e.category, e.startedAt);
  d.startedAt = e.startedAt;
  d.durationMin = e.endedAt ? Math.max(0, Math.round((e.endedAt.getTime() - e.startedAt.getTime()) / 60_000)) : 0;
  d.note = e.note ?? '';
  d.medicationId = e.medicationId ?? null;
  const x = e.details as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  switch (e.category) {
    case 'feed':
      d.feedKind = x.kind as Draft['feedKind'];
      d.side = (x.lastSide as Draft['side'] | undefined) ?? lastSegmentSide(x) ?? 'left';
      d.amount = num(x.amount) ?? d.amount;
      d.unit = (x.unit as Draft['unit']) ?? 'ml';
      d.milk = (x.milk as Draft['milk']) ?? null;
      d.foods = ((x.foods as string[] | undefined) ?? []).join(', ');
      break;
    case 'pump':
      d.pumpKind = x.kind as Draft['pumpKind'];
      d.left = num(x.left) ?? 0;
      d.right = num(x.right) ?? 0;
      if (d.pumpKind === 'single' && x.left === undefined) d.left = num(x.total) ?? 0;
      d.unit = (x.unit as Draft['unit']) ?? 'ml';
      d.use = (x.use as Draft['use']) ?? null;
      d.storage = (x.storage as Draft['storage']) ?? null;
      break;
    case 'sleep':
      d.sleepKind = x.kind as Draft['sleepKind'];
      d.place = (x.place as Draft['place']) ?? null;
      break;
    case 'diaper':
      d.diaperKind = x.kind as Draft['diaperKind'];
      d.colour = (x.colour as Draft['colour']) ?? null;
      d.consistency = (x.consistency as Draft['consistency']) ?? null;
      d.rash = x.rash === true;
      break;
    case 'med':
      d.dose = num(x.dose) ?? d.dose;
      d.doseUnit = (x.unit as string) ?? d.doseUnit;
      d.reason = (x.reason as string) ?? '';
      d.temperatureC = num(x.temperatureC);
      break;
    case 'milestone':
      d.milestoneKind = x.kind as Draft['milestoneKind'];
      d.title = (x.title as string) ?? '';
      d.weightKg = num(x.weightKg);
      d.lengthCm = num(x.lengthCm);
      d.headCm = num(x.headCm);
      break;
  }
  return d;
}

const positive = (n: number | null | undefined) => (n && n > 0 ? n : undefined);
const text = (s: string) => s.trim() || undefined;

/**
 * The details a draft describes, validated. `existing` keeps fields the sheet
 * doesn't edit (breast segments recorded by a timer, for instance).
 */
export function draftDetails(d: Draft, existing?: unknown): DetailsFor<Category> {
  const prev = (existing ?? {}) as Record<string, unknown>;
  let raw: Record<string, unknown>;
  switch (d.category) {
    case 'feed':
      if (d.feedKind === 'breast') {
        const keep = prev.kind === 'breast' ? (prev.segments as unknown[] | undefined) : undefined;
        raw = { kind: 'breast', segments: keep ?? [], lastSide: d.side };
      } else if (d.feedKind === 'bottle') {
        raw = { kind: 'bottle', amount: positive(d.amount), unit: d.unit, milk: d.milk ?? undefined };
      } else {
        const foods = d.foods.split(',').map((f) => f.trim()).filter(Boolean);
        raw = { kind: 'solids', foods };
      }
      break;
    case 'pump': {
      const left = d.left || 0;
      const right = d.pumpKind === 'double' ? d.right || 0 : 0;
      raw = {
        kind: d.pumpKind,
        left: d.pumpKind === 'double' ? left : undefined,
        right: d.pumpKind === 'double' ? right : undefined,
        total: left + right,
        unit: d.unit,
        use: d.use ?? undefined,
        storage: d.use === 'stored' ? (d.storage ?? undefined) : undefined,
      };
      break;
    }
    case 'sleep':
      raw = { kind: d.sleepKind, place: d.place ?? undefined };
      break;
    case 'diaper':
      raw = {
        kind: d.diaperKind,
        colour: d.diaperKind === 'dirty' || d.diaperKind === 'mixed' ? (d.colour ?? undefined) : undefined,
        consistency: d.diaperKind === 'dirty' || d.diaperKind === 'mixed' ? (d.consistency ?? undefined) : undefined,
        rash: d.rash || undefined,
      };
      break;
    case 'med':
      raw = {
        kind: 'dose',
        dose: d.dose,
        unit: d.doseUnit.trim() || 'ml',
        reason: text(d.reason),
        temperatureC: d.temperatureC ?? undefined,
      };
      break;
    case 'milestone':
      raw =
        d.milestoneKind === 'growth'
          ? { kind: 'growth', weightKg: positive(d.weightKg), lengthCm: positive(d.lengthCm), headCm: positive(d.headCm) }
          : { kind: d.milestoneKind, title: d.title.trim() };
      break;
  }
  return detailsSchema[d.category].parse(raw) as DetailsFor<Category>;
}

/** Why the draft can't be saved yet, or null when it can. */
export function draftProblem(d: Draft): string | null {
  if (d.category === 'med' && !d.medicationId) return 'Pick a medication';
  if (d.category === 'med' && !(d.dose > 0)) return 'Enter a dose';
  if (d.category === 'milestone' && d.milestoneKind !== 'growth' && !d.title.trim()) return 'Give the milestone a name';
  if (d.category === 'milestone' && d.milestoneKind === 'growth' && !d.weightKg && !d.lengthCm && !d.headCm)
    return 'Enter at least one measurement';
  try {
    draftDetails(d);
  } catch {
    return 'Check the numbers';
  }
  return null;
}

/** End time for a draft: timed categories use the duration, point events end when they start. */
export function draftEnd(d: Draft, timed: boolean): Date {
  if (!timed) return d.startedAt;
  return new Date(d.startedAt.getTime() + d.durationMin * 60_000);
}
