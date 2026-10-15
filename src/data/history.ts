import type { HistoryRow } from '@/domain/history';
import { supabase, supabaseConfigured } from '@/lib/supabase';

/** An entry's edit history. It lives on the server only, so it needs a connection. */
export async function fetchHistory(entryId: string): Promise<HistoryRow[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase
    .from('entry_history')
    .select('id, changed_by, changed_at, op, before, after')
    .eq('entry_id', entryId)
    .order('changed_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    changedBy: (r.changed_by as string | null) ?? null,
    changedAt: new Date(r.changed_at as string),
    op: r.op as HistoryRow['op'],
    before: (r.before as Record<string, unknown> | null) ?? null,
    after: (r.after as Record<string, unknown> | null) ?? null,
  }));
}
