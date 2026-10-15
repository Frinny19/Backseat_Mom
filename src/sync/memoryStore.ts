import type { LocalStore, OutboxItem, Row, SyncedTable } from './types';

/** LocalStore kept in memory: for tests, and for the web build where SQLite isn't set up. */
export class MemoryStore implements LocalStore {
  private tables = new Map<SyncedTable, Map<string, Row>>();
  private queue: OutboxItem[] = [];
  private seq = 0;
  private meta = new Map<string, string>();

  private table(t: SyncedTable) {
    let m = this.tables.get(t);
    if (!m) this.tables.set(t, (m = new Map()));
    return m;
  }

  async get(t: SyncedTable, id: string) {
    const row = this.table(t).get(id);
    return row ? structuredClone(row) : null;
  }

  async all(t: SyncedTable) {
    return [...this.table(t).values()].map((r) => structuredClone(r));
  }

  async entriesForBaby(babyId: string, since: string) {
    return (await this.all('entries')).filter((r) => r.baby_id === babyId && String(r.started_at) >= since);
  }

  async put(t: SyncedTable, row: Row) {
    this.table(t).set(row.id, structuredClone(row));
  }

  async remove(t: SyncedTable, id: string) {
    this.table(t).delete(id);
  }

  async enqueue(item: Omit<OutboxItem, 'seq'>) {
    this.queue.push({ ...structuredClone(item), seq: ++this.seq });
  }

  async outbox() {
    return this.queue.map((i) => structuredClone(i));
  }

  async dequeue(seq: number) {
    this.queue = this.queue.filter((i) => i.seq !== seq);
  }

  async getMeta(key: string) {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
  }

  async clear() {
    this.tables.clear();
    this.queue = [];
    this.meta.clear();
  }
}
