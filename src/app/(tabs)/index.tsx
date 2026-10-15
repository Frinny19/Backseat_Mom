import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityCard, QuickLog, Ribbon, StatTile } from '@/components';
import { CATEGORY_INFO } from '@/domain/categories';
import { buildRibbon, visibleCategories } from '@/domain/ribbon';
import { entryTitle, quickLogHint, todaysEntries, todayTotals } from '@/domain/timeline';
import { SyncBadge } from '@/components/SyncBadge';
import { useAppData } from '@/data/DataProvider';
import { useBabyData } from '@/hooks/useBabyData';
import { useNow } from '@/hooks/useNow';
import { formatAge, formatAgo, formatClock, formatDuration } from '@/lib/time';
import { font, radius, space, text, useTheme } from '@/theme';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Hello, night owl';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Today() {
  const { c, shadow } = useTheme();
  const now = useNow(1000);
  const data = useAppData();
  const { baby, entries, medicationNames, names, prefs, demo } = useBabyData();
  const ribbon = buildRibbon(entries, prefs, now, medicationNames);
  const visible = visibleCategories(prefs);
  const today = todaysEntries(entries, now);
  const totals = todayTotals(entries, now);
  const latestSeen = new Set<string>();

  const open = (category: string) => router.push(`/log/${category}`);
  const hide = (category: (typeof visible)[number]) => {
    // Keep at least one category on the ribbon.
    if (data && baby && visible.length > 1) data.setRibbonPrefs(baby.id, { ...prefs, hidden: [...prefs.hidden, category] });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[text('caption'), { color: c.inkMuted }]}>
            {baby ? `${baby.name}${baby.birthDate ? ` · ${formatAge(baby.birthDate, now)}` : ''}` : ' '}
          </Text>
          <Text style={[styles.hello, { color: c.ink }]}>{greeting(now)}</Text>
          <SyncBadge />
        </View>
        <View style={[styles.avatar, { backgroundColor: c.medTint, borderColor: c.surface }]} accessibilityElementsHidden>
          <Text style={[styles.avatarText, { color: c.medInk }]}>{baby?.name.charAt(0) ?? '?'}</Text>
        </View>
      </View>

      {/* Pinned: stays visible while the rest of Today scrolls. */}
      <View style={styles.ribbon}>
        <Ribbon
          items={ribbon.map((it) => ({
            ...it,
            onPress: () => (it.active && it.entryId ? router.push(`/timer/${it.entryId}`) : open(it.activity)),
            onLongPress: () => hide(it.activity),
          }))}
          onEdit={() => router.push('/ribbon')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={demo || !data ? undefined : <RefreshControl refreshing={false} onRefresh={() => data.engine.requestSync()} />}
      >
        {demo ? (
          <View style={[styles.banner, { backgroundColor: c.surfaceSunken }]}>
            <Text style={[text('caption'), { color: c.inkMuted }]}>
              Sample data on this phone only. Connect Supabase in .env to log for real.
            </Text>
          </View>
        ) : null}

        <Text style={[styles.h2, { color: c.ink }]}>Quick log</Text>
        <View style={styles.grid}>
          {chunk(visible, 3).map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((cat) => (
                <QuickLog
                  key={cat}
                  activity={cat}
                  label={CATEGORY_INFO[cat].label}
                  sub={quickLogHint(cat, entries, now)}
                  onPress={() => open(cat)}
                />
              ))}
              {Array.from({ length: 3 - row.length }, (_, k) => (
                <View key={`pad${k}`} style={styles.pad} />
              ))}
            </View>
          ))}
        </View>

        <Text style={[styles.h2, { color: c.ink }]}>Today</Text>
        <View style={styles.row}>
          <StatTile activity="feed" label="Milk" value={totals.milkMl ? `${totals.milkMl} ml` : `${totals.feeds} feeds`} />
          <StatTile activity="sleep" label="Sleep" value={formatDuration(totals.sleepMs)} />
          <StatTile activity="diaper" label="Diapers" value={String(totals.diapers)} />
        </View>

        <Text style={[styles.h2, { color: c.ink }]}>Timeline</Text>
        <View style={styles.list}>
          {today.length === 0 ? (
            <View style={[styles.empty, shadow.soft, { backgroundColor: c.surface }]}>
              <Text style={[text('body'), { color: c.inkMuted }]}>Nothing logged yet today.</Text>
            </View>
          ) : (
            today.map((e) => {
              const first = !latestSeen.has(e.category);
              latestSeen.add(e.category);
              return (
                <ActivityCard
                  key={e.id}
                  activity={e.category}
                  title={entryTitle(e, e.medicationId ? medicationNames[e.medicationId] : undefined)}
                  detail={[e.note, e.createdBy ? `by ${names[e.createdBy] ?? 'Someone'}` : null].filter(Boolean).join(' · ') || undefined}
                  time={formatClock(e.startedAt)}
                  ago={first ? (e.endedAt === null ? 'Now' : formatAgo(e.startedAt, now)) : undefined}
                  onPress={() => router.push(e.endedAt === null ? `/timer/${e.id}` : `/entry/${e.id}`)}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingTop: space[6] },
  headerText: { flex: 1 },
  hello: { ...font('display', 600, 30, 36), marginTop: 2 },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarText: font('display', 600, 20, 24),
  ribbon: { marginTop: space[4] },
  content: { paddingHorizontal: space[4], paddingBottom: 120 },
  banner: { padding: space[3], borderRadius: radius.sm, marginTop: space[2] },
  h2: { ...font('display', 600, 20, 26), marginTop: space[6], marginBottom: space[3] },
  grid: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[2] },
  pad: { flex: 1 },
  list: { gap: space[3] },
  empty: { padding: space[4], borderRadius: radius.md },
});
