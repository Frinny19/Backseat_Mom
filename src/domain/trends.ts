import type { Entry } from './entries';

export type DayTotals = {
  /** Midnight at the start of the day. */
  day: Date;
  feeds: number;
  milkMl: number;
  breastMs: number;
  sleepMs: number;
  diapers: number;
  wet: number;
  dirty: number;
  pumpMl: number;
};

const toMl = (amount: number, unit: unknown) => (unit === 'oz' ? amount * 29.5735 : amount);

function midnight(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  return m;
}

/**
 * Totals for each of the last `days` days, oldest first, ending today. Sleep
 * that crosses midnight is split between the two days.
 */
export function dailyTotals(entries: Entry[], now: Date, days: number): DayTotals[] {
  const out: DayTotals[] = [];
  const today = midnight(now);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    out.push({ day, feeds: 0, milkMl: 0, breastMs: 0, sleepMs: 0, diapers: 0, wet: 0, dirty: 0, pumpMl: 0 });
  }
  const bounds = out.map((t) => {
    const end = new Date(t.day);
    end.setDate(end.getDate() + 1);
    return [t.day.getTime(), Math.min(end.getTime(), now.getTime())] as const;
  });
  const indexOf = (d: Date) => bounds.findIndex(([a, b]) => d.getTime() >= a && d.getTime() < b);

  for (const e of entries) {
    if (e.deletedAt) continue;
    const d = e.details as Record<string, unknown> & { kind: string };
    if (e.category === 'sleep') {
      const from = e.startedAt.getTime();
      const to = (e.endedAt ?? now).getTime();
      bounds.forEach(([a, b], i) => {
        const overlap = Math.min(to, b) - Math.max(from, a);
        if (overlap > 0) out[i].sleepMs += overlap;
      });
      continue;
    }
    const i = indexOf(e.startedAt);
    if (i < 0) continue;
    const t = out[i];
    switch (e.category) {
      case 'feed':
        t.feeds += 1;
        if (d.kind === 'bottle' && typeof d.amount === 'number') t.milkMl += toMl(d.amount, d.unit);
        if (d.kind === 'breast') t.breastMs += ((e.endedAt ?? now).getTime() - e.startedAt.getTime());
        break;
      case 'diaper':
        t.diapers += 1;
        if (d.kind === 'wet' || d.kind === 'mixed') t.wet += 1;
        if (d.kind === 'dirty' || d.kind === 'mixed') t.dirty += 1;
        break;
      case 'pump': {
        const total = typeof d.total === 'number' ? d.total : ((d.left as number) ?? 0) + ((d.right as number) ?? 0);
        t.pumpMl += toMl(total, d.unit);
        break;
      }
    }
  }
  for (const t of out) {
    t.milkMl = Math.round(t.milkMl);
    t.pumpMl = Math.round(t.pumpMl);
  }
  return out;
}

const anything = (t: DayTotals) => t.feeds + t.sleepMs + t.diapers + t.pumpMl > 0;

/**
 * Average of a field over the finished days (today is still going), starting
 * from the first day anything was logged so a new user's empty days don't drag it down.
 */
export function average(totals: DayTotals[], pick: (t: DayTotals) => number): number | null {
  const first = totals.findIndex(anything);
  const past = first < 0 ? [] : totals.slice(first, -1);
  if (!past.length) return null;
  return past.reduce((s, t) => s + pick(t), 0) / past.length;
}
