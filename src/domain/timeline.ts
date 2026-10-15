import { formatClock, formatDuration } from '@/lib/time';

import type { Category } from './categories';
import type { Entry } from './entries';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Card title: the what and the amount. "Bottle · 120 ml", "Nap · 1 h 25 m", "Diaper · wet". */
export function entryTitle(entry: Entry, medicationName?: string): string {
  const d = entry.details as Record<string, unknown> & { kind: string };
  const running = entry.endedAt === null;
  const length = entry.endedAt ? formatDuration(entry.endedAt.getTime() - entry.startedAt.getTime()) : null;
  const timed = (name: string) =>
    running ? `${name} · started ${formatClock(entry.startedAt)}` : length ? `${name} · ${length}` : name;
  switch (entry.category) {
    case 'feed':
      if (d.kind === 'bottle') return d.amount ? `Bottle · ${d.amount} ${d.unit ?? 'ml'}` : 'Bottle';
      if (d.kind === 'solids') return 'Solids';
      return timed('Breast');
    case 'pump': {
      const total = (d.total as number | undefined) ?? ((d.left as number) ?? 0) + ((d.right as number) ?? 0);
      return running ? timed('Pump') : total ? `Pump · ${total} ${d.unit ?? 'ml'}` : timed('Pump');
    }
    case 'sleep':
      return timed(d.kind === 'night' ? 'Night sleep' : 'Nap');
    case 'diaper':
      return `Diaper · ${d.kind}`;
    case 'med':
      return `${medicationName ?? 'Medication'} · ${d.dose} ${d.unit}`;
    case 'milestone':
      return d.kind === 'growth' ? 'Growth' : cap(String(d.title));
  }
}

function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Live entries that started today, newest first. */
export function todaysEntries(entries: Entry[], now: Date): Entry[] {
  const start = startOfDay(now).getTime();
  return entries
    .filter((e) => !e.deletedAt && e.startedAt.getTime() >= start && e.startedAt.getTime() <= now.getTime())
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export type TodayTotals = {
  /** Bottle and pumped-milk-fed volume in ml. */
  milkMl: number;
  feeds: number;
  /** Sleep since midnight, including a nap that is running now. */
  sleepMs: number;
  diapers: number;
  wetDiapers: number;
};

const toMl = (amount: number, unit: unknown) => (unit === 'oz' ? amount * 29.5735 : amount);

export function todayTotals(entries: Entry[], now: Date): TodayTotals {
  const start = startOfDay(now).getTime();
  const totals: TodayTotals = { milkMl: 0, feeds: 0, sleepMs: 0, diapers: 0, wetDiapers: 0 };
  for (const e of entries) {
    if (e.deletedAt) continue;
    const d = e.details as Record<string, unknown> & { kind: string };
    if (e.category === 'sleep') {
      const from = Math.max(e.startedAt.getTime(), start);
      const to = Math.min((e.endedAt ?? now).getTime(), now.getTime());
      if (to > from) totals.sleepMs += to - from;
      continue;
    }
    if (e.startedAt.getTime() < start) continue;
    if (e.category === 'feed') {
      totals.feeds += 1;
      if (d.kind === 'bottle' && typeof d.amount === 'number') totals.milkMl += toMl(d.amount, d.unit);
    } else if (e.category === 'diaper') {
      totals.diapers += 1;
      if (d.kind === 'wet' || d.kind === 'mixed') totals.wetDiapers += 1;
    }
  }
  totals.milkMl = Math.round(totals.milkMl);
  return totals;
}

/** The small hint under each quick-log tile. */
export function quickLogHint(category: Category, entries: Entry[], now: Date): string | undefined {
  const live = entries.filter((e) => e.category === category && !e.deletedAt);
  const latest = live.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  switch (category) {
    case 'feed': {
      const breast = live.find((e) => (e.details as { kind: string }).kind === 'breast');
      const d = breast?.details as { lastSide?: string; segments?: { side: string }[] } | undefined;
      const last = d?.segments?.length ? d.segments[d.segments.length - 1].side : d?.lastSide;
      return last ? `${last === 'left' ? 'Right' : 'Left'} next` : 'Breast or bottle';
    }
    case 'sleep':
      return latest && latest.endedAt === null ? 'Napping' : 'Start a nap';
    case 'diaper': {
      const wet = todayTotals(entries, now).wetDiapers;
      return wet ? `${wet} wet today` : 'Wet, dirty or both';
    }
    case 'pump':
      return latest && latest.endedAt === null ? 'Pumping' : 'Both sides';
    case 'med':
      return 'Give a dose';
    case 'milestone':
      return 'Add a first';
  }
}

/** Time on each side so far for a breastfeed, counting the open segment up to `now`. */
export function sideTotals(details: unknown, now: Date): { left: number; right: number; current: 'left' | 'right' | null } {
  const segs = ((details as { segments?: { side: 'left' | 'right'; startedAt: string; endedAt?: string }[] })?.segments ?? []);
  const out = { left: 0, right: 0, current: null as 'left' | 'right' | null };
  for (const s of segs) {
    const end = s.endedAt ? new Date(s.endedAt) : now;
    out[s.side] += Math.max(0, end.getTime() - new Date(s.startedAt).getTime());
    if (!s.endedAt) out.current = s.side;
  }
  return out;
}
