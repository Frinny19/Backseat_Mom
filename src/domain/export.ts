import { formatClock, formatDuration } from '@/lib/time';

import { CATEGORY_INFO } from './categories';
import type { Entry } from './entries';
import { formatPercentile, percentile } from './growth';
import { entryTitle } from './timeline';
import { average, dailyTotals } from './trends';

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Quote anything with commas, quotes or newlines, and neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Every entry as one CSV row, oldest first, with details flattened into columns. */
export function entriesCsv(entries: Entry[], names: Record<string, string>, medNames: Record<string, string>): string {
  const detailKeys = new Set<string>();
  for (const e of entries) for (const k of Object.keys(e.details as object)) if (k !== 'kind' && k !== 'segments') detailKeys.add(k);
  const keys = [...detailKeys].sort();
  const head = ['started', 'ended', 'minutes', 'category', 'type', 'medication', ...keys, 'note', 'logged_by'];
  const rows = [...entries]
    .filter((e) => !e.deletedAt)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .map((e) => {
      const d = e.details as Record<string, unknown>;
      const minutes = e.endedAt && e.endedAt > e.startedAt ? Math.round((e.endedAt.getTime() - e.startedAt.getTime()) / 60_000) : '';
      return [
        e.startedAt.toISOString(),
        e.endedAt?.toISOString() ?? '',
        minutes,
        CATEGORY_INFO[e.category].label,
        d.kind,
        e.medicationId ? (medNames[e.medicationId] ?? '') : '',
        ...keys.map((k) => (Array.isArray(d[k]) ? (d[k] as unknown[]).join('; ') : d[k])),
        e.note ?? '',
        e.createdBy ? (names[e.createdBy] ?? '') : '',
      ];
    });
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

type SummaryInput = {
  baby: { name: string; birthDate: Date | null; sex: 'female' | 'male' | 'other' | null };
  entries: Entry[];
  milestones: Entry<'milestone'>[];
  medNames: Record<string, string>;
  ageText: string | null;
  days: number;
  now: Date;
};

/** A one-page summary for a doctor's visit, as HTML for printing to PDF. */
export function doctorSummaryHtml({ baby, entries, milestones, medNames, ageText, days, now }: SummaryInput): string {
  const totals = dailyTotals(entries, now, days + 1);
  const avg = (pick: Parameters<typeof average>[1]) => average(totals, pick) ?? 0;
  const from = totals[0].day;
  const sex = baby.sex === 'female' || baby.sex === 'male' ? baby.sex : null;

  const growth = milestones
    .filter((e) => e.details.kind === 'growth')
    .slice(-6)
    .map((e) => {
      const g = e.details as { weightKg?: number; lengthCm?: number; headCm?: number };
      const p = (m: 'weight' | 'length' | 'head', v?: number) => {
        if (v === undefined) return '–';
        const pct = sex && baby.birthDate ? percentile(m, sex, baby.birthDate, e.startedAt, v) : null;
        return `${v}${pct !== null ? ` <span class="muted">(${formatPercentile(pct)})</span>` : ''}`;
      };
      return `<tr><td>${e.startedAt.toLocaleDateString()}</td><td>${p('weight', g.weightKg)}</td><td>${p('length', g.lengthCm)}</td><td>${p('head', g.headCm)}</td></tr>`;
    })
    .join('');

  const since = from.getTime();
  const doses = entries
    .filter((e) => e.category === 'med' && !e.deletedAt && e.startedAt.getTime() >= since)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 20)
    .map((e) => {
      const d = e.details as { reason?: string; temperatureC?: number };
      return `<tr><td>${e.startedAt.toLocaleDateString()} ${formatClock(e.startedAt)}</td><td>${esc(entryTitle(e, e.medicationId ? medNames[e.medicationId] : undefined))}</td><td>${esc(d.reason ?? '')}</td><td>${d.temperatureC ? `${d.temperatureC} °C` : ''}</td></tr>`;
    })
    .join('');

  const firsts = milestones
    .filter((e) => e.details.kind !== 'growth' && e.startedAt.getTime() >= since - 60 * 24 * 3600_000)
    .slice(-10)
    .map((e) => `<li>${esc((e.details as { title: string }).title)} <span class="muted">${e.startedAt.toLocaleDateString()}</span></li>`)
    .join('');

  const row = (label: string, value: string) => `<tr><th>${label}</th><td>${value}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#3a2e45;margin:32px;font-size:12px}
h1{font-size:22px;margin:0}h2{font-size:14px;margin:20px 0 6px;border-bottom:1px solid #f0e2d4;padding-bottom:4px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 8px 4px 0;vertical-align:top}th{font-weight:600;width:45%}
.muted{color:#76687f}ul{margin:0;padding-left:18px}
</style></head><body>
<h1>${esc(baby.name)}</h1>
<p class="muted">${[ageText, baby.birthDate ? `born ${baby.birthDate.toLocaleDateString()}` : null].filter(Boolean).join(' · ')}<br>
Daily averages for ${from.toLocaleDateString()} to ${totals[totals.length - 2].day.toLocaleDateString()} (${days} days). Prepared ${now.toLocaleDateString()} with Backseat Mom.</p>
<h2>Feeding</h2><table>
${row('Feeds per day', avg((t) => t.feeds).toFixed(1))}
${row('Bottle milk per day', `${Math.round(avg((t) => t.milkMl))} ml`)}
${row('Time at the breast per day', formatDuration(avg((t) => t.breastMs)))}
${row('Pumped per day', `${Math.round(avg((t) => t.pumpMl))} ml`)}
</table>
<h2>Sleep and diapers</h2><table>
${row('Sleep per day', formatDuration(avg((t) => t.sleepMs)))}
${row('Wet diapers per day', avg((t) => t.wet).toFixed(1))}
${row('Dirty diapers per day', avg((t) => t.dirty).toFixed(1))}
</table>
${growth ? `<h2>Growth</h2><table><tr><th>Date</th><th>Weight (kg)</th><th>Length (cm)</th><th>Head (cm)</th></tr>${growth}</table>${sex ? '<p class="muted">Percentiles from the WHO Child Growth Standards.</p>' : ''}` : ''}
${doses ? `<h2>Medication doses</h2><table><tr><th>When</th><th>Dose</th><th>Reason</th><th>Temp</th></tr>${doses}</table>` : ''}
${firsts ? `<h2>Recent milestones</h2><ul>${firsts}</ul>` : ''}
</body></html>`;
}
