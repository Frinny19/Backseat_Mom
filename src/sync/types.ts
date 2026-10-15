/**
 * Offline-first sync between the on-device database and Supabase.
 *
 * Every write lands in the local store first and is queued in the outbox; the
 * engine pushes the queue in order when online and pulls changes since the last
 * cursor. Updates send only the fields that changed, so two people editing
 * different fields of the same entry both keep their change. Deletes are soft
 * (`deleted_at`), so nothing disappears silently.
 */

export type Row = Record<string, unknown> & { id: string };

/** Tables the app reads offline. Only some are written from the phone. */
export const SYNCED_TABLES = ['profiles', 'family_members', 'babies', 'medications', 'entries', 'ribbon_prefs'] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export const WRITABLE_TABLES = ['babies', 'medications', 'entries', 'ribbon_prefs'] as const;
export type WritableTable = (typeof WRITABLE_TABLES)[number];

export type OutboxOp = 'insert' | 'patch' | 'upsert';

export type OutboxItem = {
  seq: number;
  table: WritableTable;
  id: string;
  op: OutboxOp;
  fields: Record<string, unknown>;
  createdAt: string;
};

/** The on-device database. Implemented on expo-sqlite in the app and in memory for tests and web. */
export interface LocalStore {
  get(table: SyncedTable, id: string): Promise<Row | null>;
  all(table: SyncedTable): Promise<Row[]>;
  /** Entries for one baby that started at or after `since` (ISO), any deletion state. */
  entriesForBaby(babyId: string, since: string): Promise<Row[]>;
  put(table: SyncedTable, row: Row): Promise<void>;
  remove(table: SyncedTable, id: string): Promise<void>;

  enqueue(item: Omit<OutboxItem, 'seq'>): Promise<void>;
  outbox(): Promise<OutboxItem[]>;
  dequeue(seq: number): Promise<void>;

  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  /** Removes everything, for sign-out. */
  clear(): Promise<void>;
}

export type RemoteErrorKind = 'network' | 'rejected';

export class RemoteError extends Error {
  constructor(
    message: string,
    readonly kind: RemoteErrorKind,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** The server. Implemented on supabase-js in the app and faked in tests. */
export interface RemoteApi {
  insert(table: WritableTable, row: Row): Promise<void>;
  patch(table: WritableTable, id: string, fields: Record<string, unknown>): Promise<void>;
  upsert(table: WritableTable, row: Row): Promise<void>;
  /** Rows changed at or after `since` (ISO), oldest first. */
  changedSince(table: SyncedTable, since: string | null, limit: number): Promise<Row[]>;
}

export type SyncStatus = {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSyncedAt: string | null;
  /** Changes the server refused (for example after losing access); they are dropped, not retried. */
  rejected: number;
  error: string | null;
};
