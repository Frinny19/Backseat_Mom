import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { SyncEngine } from '@/sync/engine';
import { MemoryStore } from '@/sync/memoryStore';
import { SupabaseRemote } from '@/sync/supabaseRemote';
import type { LocalStore, SyncedTable, SyncStatus } from '@/sync/types';

import { AppData } from './appData';
import { DEMO_CONTEXT, seedDemo } from './demo';

const DataContext = createContext<AppData | null>(null);

const SYNC_EVERY_MS = 60_000;

async function openStore(name: string): Promise<LocalStore> {
  // The web build (used for previews) keeps data in memory.
  if (Platform.OS === 'web') return new MemoryStore();
  const { SqliteStore } = await import('@/sync/sqliteStore');
  return SqliteStore.open(name);
}

/**
 * Opens the on-device database for the signed-in person and keeps it in sync:
 * after every write, when the app comes to the foreground, when the network
 * returns, when Supabase Realtime reports a change, and every minute.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.session?.user.id ?? null);
  const familyId = useSession((s) => s.family?.id ?? null);
  const [data, setData] = useState<AppData | null>(null);

  const demo = status === 'demo';
  const key = demo ? 'demo' : userId && familyId ? `${userId}:${familyId}` : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    (async () => {
      if (demo) {
        const store = new MemoryStore();
        await seedDemo(store, new Date());
        const engine = new SyncEngine(store, null);
        if (!cancelled) setData(new AppData(engine, DEMO_CONTEXT, Crypto.randomUUID));
        return;
      }
      const store = await openStore(`backseat-${userId}.db`);
      const engine = new SyncEngine(store, new SupabaseRemote(supabase));
      if (cancelled) return;
      setData(new AppData(engine, { userId: userId!, familyId: familyId! }, Crypto.randomUUID));
      engine.requestSync();

      cleanups.push(
        NetInfo.addEventListener((s) => engine.setOnline(s.isConnected !== false && s.isInternetReachable !== false)),
      );
      const app = AppState.addEventListener('change', (s) => s === 'active' && engine.requestSync());
      cleanups.push(() => app.remove());
      const timer = setInterval(() => AppState.currentState === 'active' && engine.requestSync(), SYNC_EVERY_MS);
      cleanups.push(() => clearInterval(timer));

      const channel = supabase.channel(`family:${familyId}`);
      for (const table of ['entries', 'medications', 'babies', 'family_members'] as const) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, () =>
          engine.requestSync(),
        );
      }
      channel.subscribe();
      cleanups.push(() => {
        supabase.removeChannel(channel);
      });
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      setData(null);
    };
  }, [key, demo, userId, familyId]);

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

/** The app's data layer, or null while it opens. */
export function useAppData(): AppData | null {
  return useContext(DataContext);
}

/**
 * Runs `query` against the local database and runs it again whenever one of
 * `tables` changes. `deps` are the query's other inputs.
 */
export function useLive<T>(
  tables: SyncedTable[],
  query: (data: AppData) => Promise<T>,
  deps: unknown[],
  initial: T,
): T {
  const data = useAppData();
  const [value, setValue] = useState<T>(initial);
  const runQuery = useEffectEvent((d: AppData) => query(d));
  const tableKey = tables.join(',');

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let version = 0;
    const run = () => {
      const mine = ++version;
      runQuery(data).then((v) => {
        if (!cancelled && mine === version) setValue(v);
      });
    };
    run();
    const watched = new Set(tableKey.split(','));
    const off = data.engine.onChange((changed) => {
      for (const t of changed) if (watched.has(t)) return run();
    });
    return () => {
      cancelled = true;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tableKey, ...deps]);

  return value;
}

export function useSyncStatus(): SyncStatus | null {
  const data = useAppData();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useEffect(() => (data ? data.engine.onStatus(setStatus) : undefined), [data]);
  return data ? status : null;
}
