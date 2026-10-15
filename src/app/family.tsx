import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { Label, Segmented, TextField } from '@/components/form';
import { ErrorText } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useAppData, useLive } from '@/data/DataProvider';
import type { Member } from '@/data/rows';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { font, radius, space, text, useTheme } from '@/theme';

const NONE: Member[] = [];
const ROLE_LABEL: Record<Member['role'], string> = { owner: 'Owner', caregiver: 'Can log', viewer: 'Can view' };

/** Who's in the family, your name, and invite codes for new caregivers. */
export default function Family() {
  const { c, shadow } = useTheme();
  const data = useAppData();
  const family = useSession((s) => s.family);
  const demo = useSession((s) => s.status === 'demo');
  const members = useLive(['family_members', 'profiles'], (d) => d.members(), [], NONE);
  const me = members.find((m) => m.userId === data?.ctx.userId);
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<'caregiver' | 'viewer'>('caregiver');
  const [invite, setInvite] = useState<{ code: string; expires: Date } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const saveName = () =>
    run(async () => {
      if (!data || name === null) return;
      const { error: err } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', data.ctx.userId);
      if (err) throw new Error(err.message);
      setName(null);
      await data.engine.requestSync();
    });

  const createInvite = () =>
    run(async () => {
      if (!family) return;
      const { data: row, error: err } = await supabase.rpc('create_invite', { fid: family.id, invite_role: role });
      if (err) throw new Error(err.message);
      setInvite({ code: row.code as string, expires: new Date(row.expires_at as string) });
    });

  const share = () =>
    invite &&
    Share.share({
      message: `Join ${family?.name ?? 'our family'} on Backseat Mom. Install the app, sign in, tap "I have an invite code" and enter ${invite.code}. It works for 7 days.`,
    });

  return (
    <Sheet title={family?.name ?? 'Family'} subtitle="Everyone here sees and logs the same baby">
      {members.map((m) => (
        <View key={m.userId} style={[styles.row, shadow.soft, { backgroundColor: c.surface }]}>
          <Text style={[text('label'), styles.grow, { color: c.ink }]}>
            {m.name}
            {m.userId === data?.ctx.userId ? ' (you)' : ''}
          </Text>
          <Text style={[text('caption'), { color: c.inkMuted }]}>{ROLE_LABEL[m.role]}</Text>
        </View>
      ))}

      {!demo ? (
        <>
          <TextField
            label="Your name"
            value={name ?? me?.name ?? ''}
            onChangeText={setName}
            placeholder="What the family calls you"
          />
          {name !== null ? (
            <Button variant="soft" onPress={saveName} disabled={busy || !name.trim()}>
              Save name
            </Button>
          ) : null}
        </>
      ) : null}

      {family?.role === 'owner' && !demo ? (
        <View style={styles.invite}>
          <Text style={[text('title'), { color: c.ink }]}>Invite someone</Text>
          <Label>They can</Label>
          <Segmented
            options={[
              { id: 'caregiver', label: 'Log and edit' },
              { id: 'viewer', label: 'Only view' },
            ]}
            value={role}
            onChange={setRole}
          />
          {invite ? (
            <View style={[styles.code, { backgroundColor: c.surfaceSunken }]}>
              <Text style={[styles.codeText, { color: c.ink }]} selectable accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`}>
                {invite.code}
              </Text>
              <Text style={[text('caption'), { color: c.inkMuted }]}>
                Works once, until {invite.expires.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ) : null}
          {invite ? (
            <Button block onPress={share}>
              Share code
            </Button>
          ) : (
            <Button block onPress={createInvite} disabled={busy}>
              Create invite code
            </Button>
          )}
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {demo ? (
        <Text style={[text('caption'), { color: c.inkMuted }]}>Invites work once the app is connected to Supabase.</Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md },
  grow: { flex: 1 },
  invite: { gap: space[3], marginTop: space[4] },
  code: { alignItems: 'center', padding: space[4], borderRadius: radius.md, gap: space[1] },
  codeText: { ...font('display', 600, 36, 44), letterSpacing: 6 },
});
