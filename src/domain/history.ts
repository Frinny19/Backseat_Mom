export type HistoryRow = {
  id: string;
  changedBy: string | null;
  changedAt: Date;
  op: 'insert' | 'update' | 'delete' | 'restore';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

const FIELD_NAMES: Record<string, string> = {
  started_at: 'start time',
  ended_at: 'end time',
  details: 'details',
  note: 'note',
  medication_id: 'medication',
  kind: 'type',
};

/** "Logged", "Changed start time and note", "Deleted", "Restored". */
export function describeChange(row: HistoryRow): string {
  switch (row.op) {
    case 'insert':
      return 'Logged';
    case 'delete':
      return 'Deleted';
    case 'restore':
      return 'Restored';
    case 'update': {
      const changed = Object.keys(FIELD_NAMES).filter(
        (k) => k !== 'kind' && JSON.stringify(row.before?.[k] ?? null) !== JSON.stringify(row.after?.[k] ?? null),
      );
      if (!row.before?.ended_at && row.after?.ended_at && changed.every((k) => k === 'ended_at' || k === 'details')) {
        return 'Stopped the timer';
      }
      if (!changed.length) return 'Edited';
      const names = changed.map((k) => FIELD_NAMES[k]);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
      return `Changed ${list}`;
    }
  }
}
