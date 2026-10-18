import { formatAgo, formatClock } from '@/lib/time';

import type { Entry } from './entries';

type Limits = { id: string; name: string; minIntervalHours: number | null; maxDosesPerDay: number | null };

export type DoseWarning = { message: string; /** "max" is shown in red; "early" in the category colour. */ level: 'early' | 'max' };

/**
 * A heads-up before logging another dose: too soon after the last one, or the
 * day's limit reached. Advisory only; the parent decides.
 */
export function doseWarning(med: Limits, entries: Entry[], at: Date): DoseWarning | null {
  const doses = entries
    .filter((e) => e.category === 'med' && e.medicationId === med.id && !e.deletedAt && e.startedAt <= at)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  if (med.maxDosesPerDay) {
    const dayAgo = at.getTime() - 24 * 3600_000;
    const count = doses.filter((e) => e.startedAt.getTime() > dayAgo).length;
    if (count >= med.maxDosesPerDay) {
      return { level: 'max', message: `${count} doses of ${med.name} in the last 24 h, which is the most you set for a day.` };
    }
  }
  const last = doses[0];
  if (last && med.minIntervalHours) {
    const next = new Date(last.startedAt.getTime() + med.minIntervalHours * 3600_000);
    if (next > at) {
      return {
        level: 'early',
        message: `Last ${med.name} was ${formatAgo(last.startedAt, at).toLowerCase()}. The usual gap is ${med.minIntervalHours} h, so the next dose is from ${formatClock(next)}.`,
      };
    }
  }
  return null;
}

/** When the next dose is allowed after one given at `at`, or null without a minimum gap. */
export function nextDoseAt(med: Pick<Limits, 'minIntervalHours'>, at: Date): Date | null {
  return med.minIntervalHours ? new Date(at.getTime() + med.minIntervalHours * 3600_000) : null;
}

/** 38 °C and above counts as a fever, shown in red. */
export const FEVER_C = 38;
