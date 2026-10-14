import { formatAgo, formatClock, formatTimer } from '@/lib/time';

import { CATEGORIES, CATEGORY_INFO, type Category } from './categories';
import type { Entry } from './entries';

export type RibbonItem = {
  activity: Category;
  label: string;
  time: string;
  detail?: string;
  active?: boolean;
  never?: boolean;
  entryId?: string;
};

export type RibbonPrefs = {
  /** Categories this person hid for this baby. */
  hidden: Category[];
  /** Their chosen order; categories missing from it follow in the default order. */
  order: Category[];
};

export const DEFAULT_RIBBON_PREFS: RibbonPrefs = { hidden: [], order: [...CATEGORIES] };

/** Visible categories in the person's order. Also drives the quick-log grid. */
export function visibleCategories(prefs: RibbonPrefs): Category[] {
  const ordered = [...prefs.order.filter((c) => CATEGORIES.includes(c))];
  for (const c of CATEGORIES) if (!ordered.includes(c)) ordered.push(c);
  return ordered.filter((c) => !prefs.hidden.includes(c));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The one fact that drives the next decision, per the Ribbon component's spec. */
export function entryDetail(entry: Entry, medicationName?: string): string | undefined {
  const d = entry.details as Record<string, unknown> & { kind: string };
  switch (entry.category) {
    case 'feed':
      if (d.kind === 'breast') {
        const segs = (d.segments as { side: string }[] | undefined) ?? [];
        const side = segs.length ? segs[segs.length - 1].side : (d.lastSide as string | undefined);
        return side ? `${cap(side)} side` : 'Breast';
      }
      if (d.kind === 'bottle') return d.amount ? `${d.amount} ${d.unit ?? 'ml'}` : 'Bottle';
      return 'Solids';
    case 'pump': {
      const total = (d.total as number | undefined) ?? ((d.left as number) ?? 0) + ((d.right as number) ?? 0);
      return total ? `${total} ${d.unit ?? 'ml'}` : cap(d.kind);
    }
    case 'sleep':
      return d.kind === 'night' ? 'Night sleep' : 'Nap';
    case 'diaper':
      return cap(d.kind);
    case 'med':
      return medicationName;
    case 'milestone':
      if (d.kind === 'growth') return 'Growth';
      return d.title as string;
  }
}

function activeLabel(entry: Entry): string {
  switch (entry.category) {
    case 'sleep':
      return (entry.details as { kind: string }).kind === 'night' ? 'Sleeping' : 'Napping';
    case 'feed':
      return 'Feeding';
    case 'pump':
      return 'Pumping';
    default:
      return CATEGORY_INFO[entry.category].label;
  }
}

/**
 * Builds the ribbon from entries: for each visible category, the running entry
 * if there is one, otherwise the latest entry, otherwise "Never". Deleted
 * entries are ignored. Runs on the local database, so it works offline.
 */
export function buildRibbon(
  entries: Entry[],
  prefs: RibbonPrefs,
  now: Date,
  medicationNames: Record<string, string> = {},
): RibbonItem[] {
  return visibleCategories(prefs).map((category) => {
    const info = CATEGORY_INFO[category];
    const live = entries.filter((e) => e.category === category && !e.deletedAt);
    const running = info.timed
      ? live.filter((e) => e.endedAt === null).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]
      : undefined;
    if (running) {
      return {
        activity: category,
        label: activeLabel(running),
        time: formatTimer(running.startedAt, now),
        detail: `Started ${formatClock(running.startedAt)}`,
        active: true,
        entryId: running.id,
      };
    }
    const last = live.sort((a, b) => lastMoment(b).getTime() - lastMoment(a).getTime())[0];
    if (!last) return { activity: category, label: info.label, time: 'Never', never: true };
    const medName = last.medicationId ? medicationNames[last.medicationId] : undefined;
    return {
      activity: category,
      label: category === 'med' && medName ? medName : info.label,
      time: formatAgo(lastMoment(last), now),
      detail:
        category === 'sleep' && last.endedAt ? `Woke ${formatClock(last.endedAt)}` : entryDetail(last, medName),
      entryId: last.id,
    };
  });
}

/** Sleep counts from when it ended ("awake for…"); everything else from when it started. */
function lastMoment(e: Entry): Date {
  return e.category === 'sleep' && e.endedAt ? e.endedAt : e.startedAt;
}
