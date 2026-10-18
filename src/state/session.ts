import type { Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

import { supabase, supabaseConfigured } from '@/lib/supabase';

export type Family = { id: string; name: string; role: 'owner' | 'caregiver' | 'viewer' };
export type Baby = { id: string; familyId: string; name: string; birthDate: Date | null; sex: 'female' | 'male' | 'other' | null };

export type BabyInput = { name: string; birthDate: string | null; sex: Baby['sex'] };

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
  addBaby: (input: BabyInput) => Promise<void>;
  updateBaby: (id: string, input: BabyInput) => Promise<void>;
  selectBaby: (id: string) => void;
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

async function loadFamily(userId: string): Promise<{ family: Family | null; babies: Baby[] }> {
  const memberships = check(
    await supabase.from('family_members').select('role, families(id, name)').eq('user_id', userId),
  ) as unknown as { role: Family['role']; families: { id: string; name: string } | null }[];
  const first = memberships.find((m) => m.families);
  const family = first?.families ? { id: first.families.id, name: first.families.name, role: first.role } : null;
  let babies: Baby[] = [];
  if (family) {
    const rows = check(
      await supabase
        .from('babies')
        .select('id, family_id, name, birth_date, sex')
        .eq('family_id', family.id)
        .is('archived_at', null)
        .order('created_at'),
    ) as { id: string; family_id: string; name: string; birth_date: string | null; sex: Baby['sex'] }[];
    babies = rows.map((r) => ({
      id: r.id,
      familyId: r.family_id,
      name: r.name,
      birthDate: r.birth_date ? new Date(`${r.birth_date}T12:00:00`) : null,
      sex: r.sex ?? null,
    }));
  }
  return { family, babies };
}

type Cached = { family: Family | null; babies: (Omit<Baby, 'birthDate'> & { birthDate: string | null })[] };

async function saveCache(userId: string, value: { family: Family | null; babies: Baby[] }) {
  const cached: Cached = {
    family: value.family,
    babies: value.babies.map((b) => ({ ...b, birthDate: b.birthDate ? b.birthDate.toISOString() : null })),
  };
  try {
    await Storage.setItem(`session:${userId}`, JSON.stringify(cached));
  } catch {
    // Not critical: the app just needs a connection at the next launch.
  }
}

async function readCache(userId: string): Promise<{ family: Family | null; babies: Baby[] } | null> {
  try {
    const raw = await Storage.getItem(`session:${userId}`);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return { family: c.family, babies: c.babies.map((b) => ({ ...b, birthDate: b.birthDate ? new Date(b.birthDate) : null })) };
  } catch {
    return null;
  }
}

/** Viewers (for example grandparents) can look but not log. */
export function useCanLog(): boolean {
  return useSession((s) => s.status === 'demo' || (!!s.family && s.family.role !== 'viewer'));
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
    // First launch with no connection and nothing cached: keep trying.
    const load = () => get().refresh().catch(() => setTimeout(load, 5000));
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session });
      load();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const changed = session?.user.id !== get().session?.user.id;
      set({ session });
      if (changed) load();
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
    let family: Family | null;
    let babies: Baby[];
    try {
      ({ family, babies } = await loadFamily(session.user.id));
      await saveCache(session.user.id, { family, babies });
    } catch (e) {
      // Offline at launch: carry on with what we saw last time.
      const cached = await readCache(session.user.id);
      if (!cached) throw e;
      ({ family, babies } = cached);
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

  selectBaby(id) {
    if (get().babies.some((b) => b.id === id)) set({ babyId: id });
  },

  async addBaby({ name, birthDate, sex }) {
    const family = get().family;
    if (!family) throw new Error('Create a family first');
    const row = check(
      await supabase.from('babies').insert({ family_id: family.id, name: name.trim(), birth_date: birthDate, sex }).select('id').single(),
    ) as { id: string };
    await get().refresh();
    get().selectBaby(row.id);
  },

  async updateBaby(id, { name, birthDate, sex }) {
    check(await supabase.from('babies').update({ name: name.trim(), birth_date: birthDate, sex }).eq('id', id));
    await get().refresh();
  },
}));
