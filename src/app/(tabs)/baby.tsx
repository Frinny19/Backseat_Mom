import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { Segmented } from '@/components/form';
import { useBabyData } from '@/hooks/useBabyData';
import { formatAge } from '@/lib/time';
import { useSession } from '@/state/session';
import { useSettings, type ThemePreference } from '@/state/settings';
import { font, radius, space, text, useTheme } from '@/theme';

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'Phone' },
  { id: 'light', label: 'Daytime' },
  { id: 'dark', label: 'Night feed' },
];

const LINKS: { href: Href; title: string; sub: string }[] = [
  { href: '/history', title: 'History', sub: 'Everything from the last five weeks' },
  { href: '/export', title: 'Export for the doctor', sub: 'A PDF summary, or everything as a spreadsheet' },
  { href: '/family', title: 'Family and invites', sub: 'Who can see and log, and invite codes' },
  { href: '/medications', title: 'Medications', sub: 'Usual doses and how often' },
  { href: '/ribbon', title: 'Edit ribbon', sub: 'Hide and reorder categories, just for you' },
  { href: '/deleted', title: 'Recently deleted', sub: 'Restore anything from the last 30 days' },
];

export default function Baby() {
  const { c, shadow } = useTheme();
  const { baby } = useBabyData();
  const family = useSession((s) => s.family);
  const babies = useSession((s) => s.babies);
  const babyId = useSession((s) => s.babyId);
  const selectBaby = useSession((s) => s.selectBaby);
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const pref = useSettings((s) => s.themePreference);
  const setPref = useSettings((s) => s.setThemePreference);

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[text('caption'), { color: c.inkMuted }]}>{family?.name ?? 'Your family'}</Text>
        <Text style={[styles.h1, { color: c.ink }]}>{baby?.name ?? 'Baby'}</Text>
        {baby?.birthDate ? (
          <Text style={[text('body'), { color: c.inkMuted }]}>{formatAge(baby.birthDate, new Date())} old</Text>
        ) : null}

        {babies.length > 1 ? (
          <Segmented options={babies.map((b) => ({ id: b.id, label: b.name }))} value={babyId ?? ''} onChange={selectBaby} />
        ) : null}
        {status === 'ready' ? (
          <View style={styles.actions}>
            {baby ? (
              <Button variant="soft" onPress={() => router.push(`/profile/${baby.id}`)}>
                Edit {baby.name}
              </Button>
            ) : null}
            <Button variant="soft" onPress={() => router.push('/profile/new')}>
              Add a baby
            </Button>
          </View>
        ) : null}

        <View style={styles.list}>
          {LINKS.map((l) => (
            <Pressable
              key={l.title}
              accessibilityRole="button"
              onPress={() => router.push(l.href)}
              style={({ pressed }) => [styles.link, shadow.soft, { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={styles.grow}>
                <Text style={[text('label'), { color: c.ink }]}>{l.title}</Text>
                <Text style={[text('caption'), { color: c.inkMuted }]}>{l.sub}</Text>
              </View>
              <Text style={[styles.chev, { color: c.inkMuted }]}>›</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[text('label'), styles.section, { color: c.ink }]}>Theme</Text>
        <Segmented options={THEMES} value={pref} onChange={setPref} />

        {status === 'ready' ? (
          <View style={styles.section}>
            <Button variant="ghost" onPress={signOut}>
              Sign out
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space[4], paddingTop: space[6], paddingBottom: 140, gap: space[3] },
  h1: font('display', 600, 30, 36),
  list: { gap: space[2], marginTop: space[3] },
  link: { flexDirection: 'row', alignItems: 'center', padding: space[4], borderRadius: radius.md },
  grow: { flex: 1 },
  chev: font('sans', 700, 24, 28),
  section: { marginTop: space[4] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
