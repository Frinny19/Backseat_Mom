import { useMemo } from 'react';

import { useAppData, useLive } from '@/data/DataProvider';
import { DEMO_BABY } from '@/data/demo';
import type { Medication } from '@/data/rows';
import type { Entry } from '@/domain/entries';
import { DEFAULT_RIBBON_PREFS, type RibbonPrefs } from '@/domain/ribbon';
import { useSession } from '@/state/session';

export type BabyData = {
  baby: { id: string; name: string; birthDate: Date | null } | null;
  /** The last five weeks, without deleted entries. */
  entries: Entry[];
  medications: Medication[];
  medicationNames: Record<string, string>;
  names: Record<string, string>;
  prefs: RibbonPrefs;
  /** False until the on-device database has opened. */
  ready: boolean;
  demo: boolean;
};

const NO_ENTRIES: Entry[] = [];
const NO_MEDS: Medication[] = [];
const NO_NAMES: Record<string, string> = {};

/** The selected baby's data from the on-device database, live. */
export function useBabyData(): BabyData {
  const status = useSession((s) => s.status);
  const babies = useSession((s) => s.babies);
  const babyId = useSession((s) => s.babyId);
  const demo = status === 'demo';
  const baby = demo ? DEMO_BABY : (babies.find((b) => b.id === babyId) ?? null);
  const id = baby?.id ?? '';
  const data = useAppData();

  const all = useLive(['entries'], (d) => d.entries(id), [id], NO_ENTRIES);
  const medications = useLive(['medications'], (d) => d.medications(id), [id], NO_MEDS);
  const names = useLive(['profiles'], (d) => d.names(), [], NO_NAMES);
  const prefs = useLive(['ribbon_prefs'], (d) => d.ribbonPrefs(id), [id], DEFAULT_RIBBON_PREFS);

  const entries = useMemo(() => all.filter((e) => !e.deletedAt), [all]);
  const medicationNames = useMemo(() => Object.fromEntries(medications.map((m) => [m.id, m.name])), [medications]);

  return { baby, entries, medications, medicationNames, names, prefs, ready: !!data, demo };
}
