import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components';
import { Chips } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/domain/categories';
import { entryTitle } from '@/domain/timeline';
import { useBabyData } from '@/hooks/useBabyData';
import { formatClock } from '@/lib/time';
import { font, space, text, useTheme } from '@/theme';

function dayLabel(d: Date, now: Date): string {
  const day = new Date(d).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  const diff = Math.round((today - day) / (24 * 3600_000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

/** Everything from the last five weeks, by day, filterable by category. */
export default function History() {
  const { c } = useTheme();
  const { entries, medicationNames, names } = useBabyData();
  const [filter, setFilter] = useState<Category | null>(null);
  const now = new Date();
  const shown = entries.filter((e) => !filter || e.category === filter);

  const days: { label: string; items: typeof shown }[] = [];
  for (const e of shown) {
    const label = dayLabel(e.startedAt, now);
    if (days[days.length - 1]?.label !== label) days.push({ label, items: [] });
    days[days.length - 1].items.push(e);
  }

  return (
    <Sheet title="History">
      <Chips
        options={CATEGORIES.map((id) => ({ id, label: CATEGORY_INFO[id].label }))}
        value={filter}
        onChange={setFilter}
        tint={c.ink}
        ink={c.surface}
      />
      {days.length === 0 ? <Text style={[text('body'), { color: c.inkMuted }]}>Nothing logged yet.</Text> : null}
      {days.map((day) => (
        <View key={day.label} style={styles.day}>
          <Text style={[styles.h2, { color: c.ink }]}>{day.label}</Text>
          {day.items.map((e) => (
            <ActivityCard
              key={e.id}
              activity={e.category}
              title={entryTitle(e, e.medicationId ? medicationNames[e.medicationId] : undefined)}
              detail={[e.note, e.createdBy ? `by ${names[e.createdBy] ?? 'Someone'}` : null].filter(Boolean).join(' · ') || undefined}
              time={formatClock(e.startedAt)}
              onPress={() => router.push(`/entry/${e.id}`)}
            />
          ))}
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  day: { gap: space[3] },
  h2: font('display', 600, 20, 26),
});
