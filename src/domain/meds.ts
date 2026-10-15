import { formatAgo, formatClock } from '@/lib/time';

import type { Entry } from './entries';

type Limits = { id: string; name: string; minIntervalHours: number | null; maxDosesPerDay: number | null };

/**
 * A heads-up before logging another dose: too soon after the last one, or the
 * day's limit reached. Advisory only; the parent decides.
 */
export function doseWarning(med: Limits, entries: Entry[], at: Date): string | null {
  const doses = entries
    .filter((e) => e.category === 'med' && e.medicationId === med.id && !e.deletedAt && e.startedAt <= at)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const last = doses[0];
  if (last && med.minIntervalHours) {
    const next = new Date(last.startedAt.getTime() + med.minIntervalHours * 3600_000);
    if (next > at) {
      return `Last ${med.name} was ${formatAgo(last.startedAt, at)}. The usual gap is ${med.minIntervalHours} h, so the next dose is from ${formatClock(next)}.`;
    }
  }
  if (med.maxDosesPerDay) {
    const dayAgo = at.getTime() - 24 * 3600_000;
    const count = doses.filter((e) => e.startedAt.getTime() > dayAgo).length;
    if (count >= med.maxDosesPerDay) return `${count} doses of ${med.name} in the last 24 h, which is the limit you set.`;
  }
  return null;
}
