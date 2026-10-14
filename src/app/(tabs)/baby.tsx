import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { Placeholder } from '@/components/Placeholder';
import { useSession } from '@/state/session';
import { useSettings, type ThemePreference } from '@/state/settings';
import { space, text, useTheme } from '@/theme';

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'Follow phone' },
  { id: 'light', label: 'Daytime' },
  { id: 'dark', label: 'Night feed' },
];

export default function Baby() {
  const { c } = useTheme();
  const family = useSession((s) => s.family);
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const pref = useSettings((s) => s.themePreference);
  const setPref = useSettings((s) => s.setThemePreference);
  return (
    <Placeholder icon="user" title={family?.name ?? 'Your family'} body="Baby profile, caregivers, invites and Recently deleted arrive in Phase 1.">
      <Text style={[text('label'), styles.section, { color: c.ink }]}>Theme</Text>
      <View style={styles.row}>
        {THEMES.map((t) => (
          <Button key={t.id} variant={pref === t.id ? 'primary' : 'soft'} onPress={() => setPref(t.id)}>
            {t.label}
          </Button>
        ))}
      </View>
      {status === 'ready' ? (
        <Button variant="ghost" onPress={signOut}>
          Sign out
        </Button>
      ) : null}
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space[4] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
