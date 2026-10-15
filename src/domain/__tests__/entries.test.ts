import { detailsSchema, parseDetails } from '../entries';

describe('details schemas', () => {
  it('accepts a bottle feed and defaults the unit to ml', () => {
    expect(parseDetails('feed', { kind: 'bottle', amount: 120 })).toEqual({ kind: 'bottle', amount: 120, unit: 'ml' });
  });

  it('rejects a diaper kind that does not exist', () => {
    expect(detailsSchema.diaper.safeParse({ kind: 'sleepy' }).success).toBe(false);
  });

  it('requires a dose amount for medication', () => {
    expect(detailsSchema.med.safeParse({ kind: 'dose', unit: 'ml' }).success).toBe(false);
    expect(detailsSchema.med.safeParse({ kind: 'dose', dose: 2.5, unit: 'ml' }).success).toBe(true);
  });

  it('validates breast-feed side segments', () => {
    const ok = detailsSchema.feed.safeParse({
      kind: 'breast',
      segments: [{ side: 'left', startedAt: '2026-10-14T09:00:00Z', endedAt: '2026-10-14T09:12:00Z' }],
    });
    expect(ok.success).toBe(true);
    expect(detailsSchema.feed.safeParse({ kind: 'breast', segments: [{ side: 'middle', startedAt: 'x' }] }).success).toBe(false);
  });
});
