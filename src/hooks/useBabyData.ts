import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEMO_BABY, DEMO_MEDICATIONS, demoEntries } from '@/data/demo';
import type { Entry } from '@/domain/entries';
import { fetchMedicationNames, fetchRecentEntries, useSession } from '@/state/session';

export type BabyData = {
  baby: { id: string; name: string; birthDate: Date | null } | null;
  entries: Entry[];
  medicationNames: Record<string, string>;
  loading: boolean;
  error: string | null;
  demo: boolean;
  reload: () => void;
};

/** Entries for the selected baby: demo data until Supabase is configured. */
export function useBabyData(): BabyData {
  const status = useSession((s) => s.status);
  const babies = useSession((s) => s.babies);
  const babyId = useSession((s) => s.babyId);
  const demo = status === 'demo';
  const baby = demo ? DEMO_BABY : (babies.find((b) => b.id === babyId) ?? null);

  const [entries, setEntries] = useState<Entry[]>(() => (demo ? demoEntries(new Date()) : []));
  const [medicationNames, setMedicationNames] = useState<Record<string, string>>(demo ? DEMO_MEDICATIONS : {});
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (demo || !baby) return;
    let cancelled = false;
    Promise.all([fetchRecentEntries(baby.id), fetchMedicationNames(baby.id)])
      .then(([e, m]) => {
        if (cancelled) return;
        setEntries(e);
        setMedicationNames(m);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [demo, baby, reloads]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloads((n) => n + 1);
  }, []);

  return useMemo(
    () => ({ baby, entries, medicationNames, loading, error, demo, reload }),
    [baby, entries, medicationNames, loading, error, demo, reload],
  );
}
