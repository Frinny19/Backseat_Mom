import {
  RemoteError,
  SYNCED_TABLES,
  type LocalStore,
  type OutboxOp,
  type RemoteApi,
  type Row,
  type SyncedTable,
  type SyncStatus,
  type WritableTable,
} from './types';

/** Re-read this much before the cursor, so a transaction that committed late isn't missed. */
const PULL_OVERLAP_MS = 5_000;
const PULL_PAGE = 500;

type Listener = (tables: Set<SyncedTable>) => void;

export class SyncEngine {
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: SyncStatus) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private status: SyncStatus = { online: true, syncing: false, pending: 0, lastSyncedAt: null, rejected: 0, error: null };

  constructor(
    readonly local: LocalStore,
    private remote: RemoteApi | null,
    private now: () => Date = () => new Date(),
  ) {}

  // -- Local writes ----------------------------------------------------------

  /** Creates a row locally and queues it for the server. */
  async insert(table: WritableTable, row: Row): Promise<void> {
    const stamped = { ...row, updated_at: this.now().toISOString() };
    await this.local.put(table, stamped);
    await this.queue(table, row.id, 'insert', row);
  }

  /** Changes some fields locally and queues only those fields. */
  async patch(table: WritableTable, id: string, fields: Record<string, unknown>): Promise<void> {
    const current = await this.local.get(table, id);
    if (!current) throw new Error(`No ${table} row ${id}`);
    await this.local.put(table, { ...current, ...fields, updated_at: this.now().toISOString() });
    await this.queue(table, id, 'patch', fields);
  }

  /** Writes a whole row the server should take as-is (rows only one person writes, like ribbon prefs). */
  async upsert(table: WritableTable, row: Row): Promise<void> {
    await this.local.put(table, { ...row, updated_at: this.now().toISOString() });
    await this.queue(table, row.id, 'upsert', row);
  }

  private async queue(table: WritableTable, id: string, op: OutboxOp, fields: Record<string, unknown>) {
    await this.local.enqueue({ table, id, op, fields, createdAt: this.now().toISOString() });
    this.emit(new Set([table]));
    await this.refreshPending();
    this.requestSync();
  }

  // -- Sync ------------------------------------------------------------------

  /** Push then pull. Calls made while a sync runs are folded into one more run. */
  requestSync(): Promise<void> {
    if (!this.remote) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.syncOnce();
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  setOnline(online: boolean) {
    this.setStatus({ online });
    if (online) this.requestSync();
  }

  private async syncOnce() {
    if (!this.remote || !this.status.online) return;
    this.setStatus({ syncing: true, error: null });
    try {
      const pushed = await this.push();
      if (!pushed) return;
      await this.pull();
      this.setStatus({ lastSyncedAt: this.now().toISOString() });
    } catch (e) {
      this.setStatus({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      await this.refreshPending();
      this.setStatus({ syncing: false });
    }
  }

  /** Sends queued writes in order. Returns false when the network dropped part way. */
  private async push(): Promise<boolean> {
    const remote = this.remote!;
    for (const item of await this.local.outbox()) {
      try {
        if (item.op === 'insert') {
          try {
            await remote.insert(item.table, item.fields as Row);
          } catch (e) {
            // Already there (a retry after a lost response): apply as an update instead.
            if (e instanceof RemoteError && e.code === '23505') {
              const { id: _id, ...rest } = item.fields;
              await remote.patch(item.table, item.id, rest);
            } else throw e;
          }
        } else if (item.op === 'patch') {
          await remote.patch(item.table, item.id, item.fields);
        } else {
          await remote.upsert(item.table, item.fields as Row);
        }
      } catch (e) {
        if (e instanceof RemoteError && e.kind === 'rejected') {
          // The server will never accept this one (lost access, invalid data). Drop it and
          // let the next pull put the server's version back on the phone.
          this.setStatus({ rejected: this.status.rejected + 1, error: e.message });
          await this.local.setMeta(`cursor:${item.table}`, '');
        } else {
          // Network trouble: keep the queue and try again on the next sync.
          this.setStatus({ error: errorMessage(e) });
          return false;
        }
      }
      await this.local.dequeue(item.seq);
      await this.refreshPending();
    }
    return true;
  }

  private async pull() {
    const remote = this.remote!;
    const changed = new Set<SyncedTable>();
    for (const table of SYNCED_TABLES) {
      let cursor = (await this.local.getMeta(`cursor:${table}`)) || null;
      for (;;) {
        const since = cursor ? new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString() : null;
        const rows = await remote.changedSince(table, since, PULL_PAGE);
        // Fields still waiting to be pushed win over what the server has, so a pull
        // never undoes an edit made offline.
        const pending = await this.pendingFields(table);
        let newest = cursor;
        for (const row of rows) {
          const mine = pending.get(row.id);
          const current = await this.local.get(table, row.id);
          const merged = mine ? { ...row, ...mine } : row;
          if (!current || JSON.stringify(current) !== JSON.stringify(merged)) {
            await this.local.put(table, merged);
            changed.add(table);
          }
          const ts = row.updated_at as string | undefined;
          if (ts && (!newest || ts > newest)) newest = ts;
        }
        if (newest && newest !== cursor) await this.local.setMeta(`cursor:${table}`, newest);
        // A full page that didn't move the cursor means every row shares one timestamp; stop.
        if (rows.length < PULL_PAGE || newest === cursor) break;
        cursor = newest;
      }
    }
    if (changed.size) this.emit(changed);
  }

  private async pendingFields(table: SyncedTable): Promise<Map<string, Record<string, unknown>>> {
    const map = new Map<string, Record<string, unknown>>();
    for (const item of await this.local.outbox()) {
      if (item.table !== table) continue;
      map.set(item.id, { ...(map.get(item.id) ?? {}), ...item.fields });
    }
    return map;
  }

  // -- Events ----------------------------------------------------------------

  /** Called with the tables whose rows changed, from a local write or a pull. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: (s: SyncStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  private emit(tables: Set<SyncedTable>) {
    for (const fn of this.listeners) fn(tables);
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.statusListeners) fn(this.status);
  }

  private async refreshPending() {
    this.setStatus({ pending: (await this.local.outbox()).length });
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
