import type { Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { categoryFromDb } from '@/domain/categories';
import type { Entry } from '@/domain/entries';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export type Family = { id: string; name: string; role: 'owner' | 'caregiver' | 'viewer' };
export type Baby = { id: string; familyId: string; name: string; birthDate: Date | null };

export type SessionStatus = 'loading' | 'demo' | 'signedOut' | 'needsFamily' | 'needsBaby' | 'ready';

type SessionState = {
  status: SessionStatus;
  session: Session | null;
  family: Family | null;
  babies: Baby[];
  babyId: string | null;
  init: () => () => void;
  refresh: () => Promise<void>;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (code: string) => Promise<void>;
  addBaby: (input: { name: string; birthDate: string | null }) => Promise<void>;
};

function statusFor(session: Session | null, family: Family | null, babies: Baby[]): SessionStatus {
  if (!session) return 'signedOut';
  if (!family) return 'needsFamily';
  if (!babies.length) return 'needsBaby';
  return 'ready';
}

/** Throws the Supabase error so screens can show it. */
function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  session: null,
  family: null,
  babies: [],
  babyId: null,

  init() {
    if (!supabaseConfigured) {
      set({ status: 'demo' });
      return () => {};
    }
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session });
      get().refresh();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const changed = session?.user.id !== get().session?.user.id;
      set({ session });
      if (changed) get().refresh();
    });
    // Refresh tokens only while the app is in the foreground.
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      sub.subscription.unsubscribe();
      appState.remove();
    };
  },

  async refresh() {
    const { session } = get();
    if (!session) {
      set({ status: 'signedOut', family: null, babies: [], babyId: null });
      return;
    }
    const memberships = check(
      await supabase.from('family_members').select('role, families(id, name)').eq('user_id', session.user.id),
    ) as unknown as { role: Family['role']; families: { id: string; name: string } | null }[];
    const first = memberships.find((m) => m.families);
    const family = first?.families ? { id: first.families.id, name: first.families.name, role: first.role } : null;
    let babies: Baby[] = [];
    if (family) {
      const rows = check(
        await supabase
          .from('babies')
          .select('id, family_id, name, birth_date')
          .eq('family_id', family.id)
          .is('archived_at', null)
          .order('created_at'),
      ) as { id: string; family_id: string; name: string; birth_date: string | null }[];
      babies = rows.map((r) => ({
        id: r.id,
        familyId: r.family_id,
        name: r.name,
        birthDate: r.birth_date ? new Date(`${r.birth_date}T12:00:00`) : null,
      }));
    }
    const babyId = babies.find((b) => b.id === get().babyId)?.id ?? babies[0]?.id ?? null;
    set({ family, babies, babyId, status: statusFor(session, family, babies) });
  },

  async sendCode(email) {
    check(await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } }));
  },

  async verifyCode(email, code) {
    const data = check(
      await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' }),
    );
    set({ session: data.session });
    await get().refresh();
  },

  async signOut() {
    await supabase.auth.signOut();
    set({ session: null, family: null, babies: [], babyId: null, status: 'signedOut' });
  },

  async createFamily(name) {
    check(await supabase.rpc('create_family', { family_name: name }));
    await get().refresh();
  },

  async joinFamily(code) {
    check(await supabase.rpc('accept_invite', { invite_code: code }));
    await get().refresh();
  },

  async addBaby({ name, birthDate }) {
    const family = get().family;
    if (!family) throw new Error('Create a family first');
    check(await supabase.from('babies').insert({ family_id: family.id, name: name.trim(), birth_date: birthDate }));
    await get().refresh();
  },
}));

type EntryRow = {
  id: string;
  baby_id: string;
  category: string;
  started_at: string;
  ended_at: string | null;
  details: Record<string, unknown>;
  note: string | null;
  medication_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
};

/**
 * Recent entries for a baby, straight from Supabase. Phase 1 replaces this with
 * PowerSync live queries against the on-device database.
 */
export async function fetchRecentEntries(babyId: string): Promise<Entry[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const rows = check(
    await supabase
      .from('entries')
      .select('id, baby_id, category, started_at, ended_at, details, note, medication_id, created_by, updated_by, deleted_at')
      .eq('baby_id', babyId)
      .is('deleted_at', null)
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(500),
  ) as EntryRow[];
  return rows.map(
    (r) =>
      ({
        id: r.id,
        babyId: r.baby_id,
        category: categoryFromDb(r.category),
        startedAt: new Date(r.started_at),
        endedAt: r.ended_at ? new Date(r.ended_at) : null,
        details: r.details,
        note: r.note,
        medicationId: r.medication_id,
        createdBy: r.created_by,
        updatedBy: r.updated_by,
        deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
      }) as Entry,
  );
}

export async function fetchMedicationNames(babyId: string): Promise<Record<string, string>> {
  const rows = check(await supabase.from('medications').select('id, name').eq('baby_id', babyId)) as {
    id: string;
    name: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
