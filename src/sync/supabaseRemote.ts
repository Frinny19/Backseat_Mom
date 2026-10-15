import type { SupabaseClient } from '@supabase/supabase-js';

import { RemoteError, type RemoteApi, type Row, type SyncedTable, type WritableTable } from './types';

/** Tables whose primary key isn't `id`: how to build the local id, and what to upsert on. */
const KEYS: Partial<Record<SyncedTable, { id: (r: Record<string, unknown>) => string; conflict: string; strip: boolean }>> = {
  family_members: { id: (r) => `${r.family_id}:${r.user_id}`, conflict: 'family_id,user_id', strip: true },
  ribbon_prefs: { id: (r) => String(r.baby_id), conflict: 'user_id,baby_id', strip: true },
};

type Result = { error: { message: string; code?: string } | null; status: number };

function check(res: Result) {
  if (!res.error) return;
  // status 0 is a failed fetch; 401 is an expired session; 408, 429 and 5xx are worth retrying.
  const s = res.status;
  const transient = s === 0 || s === 401 || s === 408 || s === 429 || s >= 500;
  throw new RemoteError(res.error.message, transient ? 'network' : 'rejected', res.error.code);
}

/** Drops the local-only `id` from rows of tables keyed on other columns. */
function toServer(table: WritableTable, row: Record<string, unknown>) {
  if (!KEYS[table]?.strip) return row;
  const { id: _id, updated_at: _u, ...rest } = row;
  return rest;
}

export class SupabaseRemote implements RemoteApi {
  constructor(private client: SupabaseClient) {}

  async insert(table: WritableTable, row: Row) {
    check(await this.client.from(table).insert(toServer(table, row)));
  }

  async patch(table: WritableTable, id: string, fields: Record<string, unknown>) {
    check(await this.client.from(table).update(fields).eq('id', id));
  }

  async upsert(table: WritableTable, row: Row) {
    const conflict = KEYS[table]?.conflict ?? 'id';
    check(await this.client.from(table).upsert(toServer(table, row), { onConflict: conflict }));
  }

  async changedSince(table: SyncedTable, since: string | null, limit: number): Promise<Row[]> {
    let q = this.client.from(table).select('*').order('updated_at').limit(limit);
    if (since) q = q.gte('updated_at', since);
    const res = await q;
    check(res);
    const key = KEYS[table];
    return ((res.data ?? []) as Record<string, unknown>[]).map((r) => (key ? { ...r, id: key.id(r) } : r) as Row);
  }
}
