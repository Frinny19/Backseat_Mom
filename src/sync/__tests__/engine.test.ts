import { SyncEngine } from '../engine';
import { MemoryStore } from '../memoryStore';
import { RemoteError, type RemoteApi, type Row, type SyncedTable, type WritableTable } from '../types';

/** A stand-in for Supabase: stamps updated_at, applies patches field by field, can go offline. */
class FakeServer {
  tables = new Map<string, Map<string, Row>>();
  clock = Date.parse('2026-10-15T08:00:00Z');
  offline = new Set<string>();
  reject: ((table: string, row: Record<string, unknown>) => boolean) | null = null;

  private t(name: string) {
    let m = this.tables.get(name);
    if (!m) this.tables.set(name, (m = new Map()));
    return m;
  }
  private stamp() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  client(name: string): RemoteApi {
    const guard = () => {
      if (this.offline.has(name)) throw new RemoteError('Network request failed', 'network');
    };
    return {
      insert: async (table: WritableTable, row: Row) => {
        guard();
        if (this.reject?.(table, row)) throw new RemoteError('new row violates row-level security policy', 'rejected', '42501');
        if (this.t(table).has(row.id)) throw new RemoteError('duplicate key', 'rejected', '23505');
        this.t(table).set(row.id, { ...row, updated_at: this.stamp() });
      },
      patch: async (table: WritableTable, id: string, fields: Record<string, unknown>) => {
        guard();
        const cur = this.t(table).get(id);
        if (cur) this.t(table).set(id, { ...cur, ...fields, updated_at: this.stamp() });
      },
      upsert: async (table: WritableTable, row: Row) => {
        guard();
        this.t(table).set(row.id, { ...row, updated_at: this.stamp() });
      },
      changedSince: async (table: SyncedTable, since: string | null, limit: number) => {
        guard();
        return [...this.t(table).values()]
          .filter((r) => !since || String(r.updated_at) >= since)
          .sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))
          .slice(0, limit)
          .map((r) => structuredClone(r));
      },
    };
  }
}

function device(server: FakeServer, name: string) {
  return new SyncEngine(new MemoryStore(), server.client(name));
}

const entry = (id: string, extra: Record<string, unknown> = {}): Row => ({
  id,
  family_id: 'f1',
  baby_id: 'b1',
  category: 'diaper',
  kind: 'wet',
  started_at: '2026-10-15T07:00:00.000Z',
  ended_at: '2026-10-15T07:00:00.000Z',
  details: { kind: 'wet' },
  note: null,
  deleted_at: null,
  ...extra,
});

async function settle(...engines: SyncEngine[]) {
  // Two rounds so each device sees what the other pushed.
  for (let i = 0; i < 2; i++) for (const e of engines) await e.requestSync();
}

describe('SyncEngine', () => {
  it('shows a write on the phone at once and delivers it to the other phone', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    const dad = device(server, 'dad');

    await mom.insert('entries', entry('e1'));
    expect(await mom.local.get('entries', 'e1')).toMatchObject({ kind: 'wet' });

    await settle(mom, dad);
    expect(await dad.local.get('entries', 'e1')).toMatchObject({ kind: 'wet', baby_id: 'b1' });
    expect(mom.getStatus().pending).toBe(0);
  });

  it('keeps writes made offline and sends them in order when back online', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    const dad = device(server, 'dad');
    server.offline.add('mom');

    await mom.insert('entries', entry('nap', { category: 'sleep', kind: 'nap', ended_at: null, details: { kind: 'nap' } }));
    await mom.patch('entries', 'nap', { ended_at: '2026-10-15T08:30:00.000Z' });
    await mom.requestSync();
    expect(mom.getStatus().pending).toBe(2);
    expect(server.tables.get('entries')).toBeUndefined();

    server.offline.delete('mom');
    await settle(mom, dad);
    expect(mom.getStatus().pending).toBe(0);
    expect(await dad.local.get('entries', 'nap')).toMatchObject({ ended_at: '2026-10-15T08:30:00.000Z' });
  });

  it('keeps both people\'s changes when they edit different fields offline', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    const dad = device(server, 'dad');
    await mom.insert('entries', entry('e1'));
    await settle(mom, dad);

    server.offline.add('mom');
    server.offline.add('dad');
    await mom.patch('entries', 'e1', { note: 'Blowout' });
    await dad.patch('entries', 'e1', { kind: 'mixed', details: { kind: 'mixed' } });

    server.offline.clear();
    await settle(mom, dad);
    for (const phone of [mom, dad]) {
      expect(await phone.local.get('entries', 'e1')).toMatchObject({ note: 'Blowout', kind: 'mixed' });
    }
  });

  it('never resurrects an entry deleted on one phone while the other edits it', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    const dad = device(server, 'dad');
    await mom.insert('entries', entry('e1'));
    await settle(mom, dad);

    server.offline.add('mom');
    server.offline.add('dad');
    await mom.patch('entries', 'e1', { deleted_at: '2026-10-15T09:00:00.000Z' });
    await dad.patch('entries', 'e1', { note: 'Was a big one' });

    server.offline.clear();
    await settle(mom, dad);
    for (const phone of [mom, dad]) {
      expect(await phone.local.get('entries', 'e1')).toMatchObject({
        deleted_at: '2026-10-15T09:00:00.000Z',
        note: 'Was a big one',
      });
    }
  });

  it('does not let a pull undo an edit that hasn\'t been pushed yet', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    const dad = device(server, 'dad');
    await mom.insert('entries', entry('e1'));
    await settle(mom, dad);

    await dad.patch('entries', 'e1', { note: 'from dad' });
    await dad.requestSync();
    // Mom edits the same field but her push fails; then she pulls Dad's change.
    server.offline.add('mom');
    await mom.patch('entries', 'e1', { note: 'from mom' });
    server.offline.delete('mom');
    // Push happens first, so mom's later edit wins on the server and both converge.
    await settle(mom, dad);
    expect(await mom.local.get('entries', 'e1')).toMatchObject({ note: 'from mom' });
    expect(await dad.local.get('entries', 'e1')).toMatchObject({ note: 'from mom' });
  });

  it('treats a retried insert the server already has as an update, without duplicates', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    await mom.insert('entries', entry('e1'));
    await mom.requestSync();
    // Simulate a lost response: the same insert is queued again.
    await mom.local.enqueue({ table: 'entries', id: 'e1', op: 'insert', fields: entry('e1', { note: 'again' }), createdAt: '' });
    await mom.requestSync();
    expect(server.tables.get('entries')!.size).toBe(1);
    expect(server.tables.get('entries')!.get('e1')).toMatchObject({ note: 'again' });
    expect(mom.getStatus().pending).toBe(0);
  });

  it('drops a write the server refuses instead of retrying it forever', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    server.reject = (_t, row) => row.id === 'bad';
    await mom.insert('entries', entry('bad'));
    await mom.insert('entries', entry('good'));
    await mom.requestSync();
    expect(mom.getStatus()).toMatchObject({ pending: 0, rejected: 1 });
    expect(server.tables.get('entries')!.has('good')).toBe(true);
  });

  it('announces which tables changed', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    const dad = device(server, 'dad');
    const seen: string[][] = [];
    dad.onChange((tables) => seen.push([...tables]));
    await mom.insert('entries', entry('e1'));
    await settle(mom, dad);
    expect(seen).toContainEqual(['entries']);
  });

  it('two phones log a day together, partly offline, with nothing lost or duplicated', async () => {
    const server = new FakeServer();
    const mom = device(server, 'mom');
    const dad = device(server, 'dad');
    const ids: string[] = [];
    for (let i = 0; i < 40; i++) {
      const phone = i % 2 ? mom : dad;
      const name = i % 2 ? 'mom' : 'dad';
      if (i % 7 === 0) server.offline.add(name);
      if (i % 11 === 0) server.offline.clear();
      const id = `e${i}`;
      ids.push(id);
      await phone.insert('entries', entry(id, { started_at: new Date(Date.UTC(2026, 9, 15, 0, i)).toISOString() }));
      if (i % 3 === 0) await phone.requestSync();
    }
    server.offline.clear();
    await settle(mom, dad);
    for (const phone of [mom, dad]) {
      const all = (await phone.local.all('entries')).map((r) => r.id).sort();
      expect(all).toEqual([...ids].sort());
    }
    expect(server.tables.get('entries')!.size).toBe(40);
  });
});
