import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart } from '@/components/charts';
import { Segmented } from '@/components/form';
import { average, dailyTotals, type DayTotals } from '@/domain/trends';
import { useBabyData } from '@/hooks/useBabyData';
import { useNow } from '@/hooks/useNow';
import { formatDuration } from '@/lib/time';
import { font, space, text, useTheme } from '@/theme';

const RANGES = [
  { id: '7', label: '7 days' },
  { id: '14', label: '14 days' },
  { id: '30', label: '30 days' },
] as const;

const dayLabel = (d: Date) => `${d.toLocaleDateString(undefined, { day: 'numeric' })} ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short' })}`;

export default function Trends() {
  const { c } = useTheme();
  const now = useNow(60_000);
  const { baby, entries } = useBabyData();
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('7');
  const totals = dailyTotals(entries, now, Number(range));

  const series = (pick: (t: DayTotals) => number, show: (v: number) => string) => ({
    bars: totals.map((t) => ({ label: dayLabel(t.day), value: pick(t), display: show(pick(t)) })),
    summary: (() => {
      const avg = average(totals, pick);
      return avg === null ? '–' : show(avg);
    })(),
  });

  const count = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const ml = (v: number) => `${Math.round(v)} ml`;
  const hasMilk = totals.some((t) => t.milkMl > 0);
  const hasPump = totals.some((t) => t.pumpMl > 0);
  const hasBreast = totals.some((t) => t.breastMs > 0);

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[text('caption'), { color: c.inkMuted }]}>{baby?.name ?? ' '}</Text>
        <Text style={[styles.h1, { color: c.ink }]}>Trends</Text>
        <Segmented options={[...RANGES]} value={range} onChange={setRange} />

        <BarChart title="Feeds" color={c.feedInk} {...series((t) => t.feeds, count)} />
        {hasMilk ? <BarChart title="Bottle milk" color={c.feedInk} {...series((t) => t.milkMl, ml)} /> : null}
        {hasBreast ? <BarChart title="Time at the breast" color={c.feedInk} {...series((t) => t.breastMs / 3600_000, (h) => formatDuration(h * 3600_000))} /> : null}
        <BarChart title="Sleep" color={c.sleepInk} {...series((t) => t.sleepMs / 3600_000, (h) => formatDuration(h * 3600_000))} />
        <BarChart title="Diapers" color={c.diaperInk} {...series((t) => t.diapers, count)} />
        <BarChart title="Wet diapers" color={c.diaperInk} {...series((t) => t.wet, count)} />
        {hasPump ? <BarChart title="Pumped" color={c.pumpInk} {...series((t) => t.pumpMl, ml)} /> : null}

        <Text style={[text('caption'), { color: c.inkMuted }]}>
          Averages leave out today, since it isn&apos;t over yet. Press and hold a bar to see that day.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space[4], paddingTop: space[6], paddingBottom: 140, gap: space[3] },
  h1: font('display', 600, 30, 36),
});
