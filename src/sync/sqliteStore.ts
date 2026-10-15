import * as SQLite from 'expo-sqlite';

import type { LocalStore, OutboxItem, Row, SyncedTable } from './types';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS records (
  tbl TEXT NOT NULL,
  id TEXT NOT NULL,
  baby_id TEXT,
  started_at TEXT,
  data TEXT NOT NULL,
  PRIMARY KEY (tbl, id)
);
CREATE INDEX IF NOT EXISTS records_baby_time ON records (tbl, baby_id, started_at);
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  tbl TEXT NOT NULL,
  id TEXT NOT NULL,
  op TEXT NOT NULL,
  fields TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

type RecordRow = { data: string };
type OutboxRow = { seq: number; tbl: string; id: string; op: string; fields: string; created_at: string };

/** LocalStore on expo-sqlite, one database file per signed-in person. */
export class SqliteStore implements LocalStore {
  private constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(name: string): Promise<SqliteStore> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync(SCHEMA);
    return new SqliteStore(db);
  }

  async get(t: SyncedTable, id: string) {
    const r = await this.db.getFirstAsync<RecordRow>('SELECT data FROM records WHERE tbl = ? AND id = ?', t, id);
    return r ? (JSON.parse(r.data) as Row) : null;
  }

  async all(t: SyncedTable) {
    const rows = await this.db.getAllAsync<RecordRow>('SELECT data FROM records WHERE tbl = ?', t);
    return rows.map((r) => JSON.parse(r.data) as Row);
  }

  async entriesForBaby(babyId: string, since: string) {
    const rows = await this.db.getAllAsync<RecordRow>(
      "SELECT data FROM records WHERE tbl = 'entries' AND baby_id = ? AND started_at >= ?",
      babyId,
      since,
    );
    return rows.map((r) => JSON.parse(r.data) as Row);
  }

  async put(t: SyncedTable, row: Row) {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO records (tbl, id, baby_id, started_at, data) VALUES (?, ?, ?, ?, ?)',
      t,
      row.id,
      (row.baby_id as string | undefined) ?? null,
      (row.started_at as string | undefined) ?? null,
      JSON.stringify(row),
    );
  }

  async remove(t: SyncedTable, id: string) {
    await this.db.runAsync('DELETE FROM records WHERE tbl = ? AND id = ?', t, id);
  }

  async enqueue(item: Omit<OutboxItem, 'seq'>) {
    await this.db.runAsync(
      'INSERT INTO outbox (tbl, id, op, fields, created_at) VALUES (?, ?, ?, ?, ?)',
      item.table,
      item.id,
      item.op,
      JSON.stringify(item.fields),
      item.createdAt,
    );
  }

  async outbox() {
    const rows = await this.db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY seq');
    return rows.map(
      (r): OutboxItem => ({
        seq: r.seq,
        table: r.tbl as OutboxItem['table'],
        id: r.id,
        op: r.op as OutboxItem['op'],
        fields: JSON.parse(r.fields),
        createdAt: r.created_at,
      }),
    );
  }

  async dequeue(seq: number) {
    await this.db.runAsync('DELETE FROM outbox WHERE seq = ?', seq);
  }

  async getMeta(key: string) {
    const r = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
    return r?.value ?? null;
  }

  async setMeta(key: string, value: string) {
    await this.db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
  }

  async clear() {
    await this.db.execAsync('DELETE FROM records; DELETE FROM outbox; DELETE FROM meta;');
  }
}
