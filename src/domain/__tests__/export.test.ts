import type { Entry } from '../entries';
import { doctorSummaryHtml, entriesCsv } from '../export';

const now = new Date('2026-10-15T12:00:00');
const e = (p: Partial<Entry> & Pick<Entry, 'category' | 'details' | 'startedAt'>) =>
  ({ id: Math.random().toString(36), babyId: 'b', endedAt: p.startedAt, ...p }) as Entry;

describe('entriesCsv', () => {
  it('writes one row per entry with flattened details, oldest first', () => {
    const csv = entriesCsv(
      [
        e({ category: 'diaper', details: { kind: 'dirty', colour: 'green' }, startedAt: new Date('2026-10-15T09:00:00Z'), createdBy: 'u1' }),
        e({ category: 'feed', details: { kind: 'bottle', amount: 120, unit: 'ml' }, startedAt: new Date('2026-10-15T08:00:00Z'), note: 'fussy, then fine' }),
      ],
      { u1: 'Sam' },
      {},
    );
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('started,ended,minutes,category,type,medication,amount,colour,unit,note,logged_by');
    expect(lines[1]).toContain('Feed,bottle,,120,,ml,"fussy, then fine",');
    expect(lines[2]).toMatch(/Diaper,dirty,,,green,,,Sam$/);
  });

  it('keeps notes from running as spreadsheet formulas', () => {
    const csv = entriesCsv([e({ category: 'diaper', details: { kind: 'wet' }, startedAt: now, note: '=HYPERLINK("x")' })], {}, {});
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('doctorSummaryHtml', () => {
  it('escapes names and includes averages', () => {
    const html = doctorSummaryHtml({
      baby: { name: '<Mila>', birthDate: null, sex: null },
      entries: [e({ category: 'diaper', details: { kind: 'wet' }, startedAt: new Date('2026-10-14T09:00:00') })],
      milestones: [],
      medNames: {},
      ageText: null,
      days: 7,
      now,
    });
    expect(html).toContain('&lt;Mila&gt;');
    expect(html).toContain('Wet diapers per day</th><td>1.0');
  });
});
