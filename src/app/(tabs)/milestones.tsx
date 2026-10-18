import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon } from '@/components';
import { GrowthChart } from '@/components/charts';
import { Segmented } from '@/components/form';
import { useLive } from '@/data/DataProvider';
import type { Entry } from '@/domain/entries';
import { CURVES, formatPercentile, MAX_DAYS, MEASURE_LABEL, percentile, UNITS, valueAtZ, type Measure } from '@/domain/growth';
import { CATALOG_AGES, MILESTONE_CATALOG } from '@/domain/milestoneCatalog';
import { useBabyData } from '@/hooks/useBabyData';
import { useNow } from '@/hooks/useNow';
import { formatAge } from '@/lib/time';
import { font, radius, space, text, useTheme } from '@/theme';

const NONE: Entry<'milestone'>[] = [];
const DAY = 24 * 3600_000;
const FIELD: Record<Measure, 'weightKg' | 'lengthCm' | 'headCm'> = { weight: 'weightKg', length: 'lengthCm', head: 'headCm' };

type Tab = 'moments' | 'growth' | 'checklist';

export default function Milestones() {
  const { c } = useTheme();
  const { baby } = useBabyData();
  const id = baby?.id ?? '';
  const all = useLive(['entries'], (d) => d.milestones(id), [id], NONE);
  const [tab, setTab] = useState<Tab>('moments');
  const now = useNow(3600_000);

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[text('caption'), { color: c.inkMuted }]}>
          {baby ? `${baby.name}${baby.birthDate ? ` · ${formatAge(baby.birthDate, now)}` : ''}` : ' '}
        </Text>
        <Text style={[styles.h1, { color: c.ink }]}>Milestones</Text>
        <Segmented
          options={[
            { id: 'moments', label: 'Moments' },
            { id: 'growth', label: 'Growth' },
            { id: 'checklist', label: 'Checklist' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'moments' ? <Moments entries={all} /> : null}
        {tab === 'growth' && baby ? <Growth entries={all} birth={baby.birthDate} sex={baby.sex} /> : null}
        {tab === 'checklist' ? <Checklist entries={all} birth={baby?.birthDate ?? null} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Moments({ entries }: { entries: Entry<'milestone'>[] }) {
  const { c, shadow } = useTheme();
  const moments = entries.filter((e) => e.details.kind !== 'growth').reverse();
  return (
    <>
      <Button block onPress={() => router.push('/log/milestone')}>
        Add a moment
      </Button>
      {moments.length === 0 ? (
        <Text style={[text('body'), { color: c.inkMuted }]}>First smiles, first foods, first trips. They all collect here.</Text>
      ) : null}
      {moments.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          onPress={() => router.push(`/entry/${e.id}`)}
          style={[styles.row, shadow.soft, { backgroundColor: c.surface }]}
        >
          <View style={[styles.well, { backgroundColor: c.milestoneTint }]}>
            <Icon name="star" size={20} color={c.milestoneInk} />
          </View>
          <View style={styles.grow}>
            <Text style={[text('label'), { color: c.ink }]}>{(e.details as { title: string }).title}</Text>
            {e.note ? <Text style={[text('caption'), { color: c.inkMuted }]}>{e.note}</Text> : null}
          </View>
          <Text style={[text('caption'), { color: c.inkMuted }]}>
            {e.startedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </Pressable>
      ))}
    </>
  );
}

function Growth({ entries, birth, sex }: { entries: Entry<'milestone'>[]; birth: Date | null; sex: 'female' | 'male' | 'other' | null }) {
  const { c, shadow } = useTheme();
  const now = useNow(3600_000);
  const [measure, setMeasure] = useState<Measure>('weight');
  const growth = entries.filter((e) => e.details.kind === 'growth');
  const unit = UNITS[measure];
  const readings = growth
    .map((e) => ({ at: e.startedAt, value: (e.details as unknown as Record<string, number | undefined>)[FIELD[measure]] }))
    .filter((r): r is { at: Date; value: number } => typeof r.value === 'number');
  const latest = readings[readings.length - 1];
  const whoSex = sex === 'female' || sex === 'male' ? sex : null;
  const pct = latest && birth && whoSex ? percentile(measure, whoSex, birth, latest.at, latest.value) : null;

  const ageDays = (d: Date) => (birth ? (d.getTime() - birth.getTime()) / DAY : 0);
  const lastAge = Math.max(...readings.map((r) => ageDays(r.at)), birth ? (now.getTime() - birth.getTime()) / DAY : 0);
  const xMax = Math.min(MAX_DAYS, Math.max(91, Math.ceil((lastAge + 30) / 91) * 91));
  const curves =
    birth && whoSex
      ? CURVES.map((cv) => ({
          label: cv.label,
          points: Array.from({ length: Math.floor(xMax / 7) + 1 }, (_, i) => ({ x: i * 7, y: valueAtZ(measure, whoSex, i * 7, cv.z)! })),
        }))
      : [];
  const points = birth
    ? readings
        .filter((r) => ageDays(r.at) >= 0 && ageDays(r.at) <= xMax)
        .map((r) => {
          const p = whoSex ? percentile(measure, whoSex, birth, r.at, r.value) : null;
          return {
            x: ageDays(r.at),
            y: r.value,
            label: `${r.value} ${unit} on ${r.at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}${p !== null ? ` · ${formatPercentile(p)} percentile` : ''}`,
          };
        })
    : [];

  return (
    <>
      <Segmented
        options={(['weight', 'length', 'head'] as const).map((m) => ({ id: m, label: MEASURE_LABEL[m] }))}
        value={measure}
        onChange={setMeasure}
      />
      <View style={[styles.card, shadow.soft, { backgroundColor: c.surface }]}>
        <Text style={[text('label'), { color: c.ink }]}>{MEASURE_LABEL[measure]}</Text>
        <Text style={[styles.value, { color: c.ink }]}>{latest ? `${latest.value} ${unit}` : 'No measurements yet'}</Text>
        {pct !== null ? (
          <Text style={[text('caption'), { color: c.inkMuted }]}>{formatPercentile(pct)} percentile for age (WHO)</Text>
        ) : null}
        {birth && points.length + curves.length > 0 ? (
          <GrowthChart points={points} curves={curves} color={c.milestoneInk} xMax={xMax} unit={unit} />
        ) : null}
        {!birth ? (
          <Text style={[text('caption'), { color: c.inkMuted }]}>Add a birth date in the baby&apos;s profile to see the chart.</Text>
        ) : !whoSex ? (
          <Text style={[text('caption'), { color: c.inkMuted }]}>Set girl or boy in the baby&apos;s profile to compare with WHO curves.</Text>
        ) : null}
      </View>
      <Button block onPress={() => router.push('/log/milestone?kind=growth')}>
        Add a measurement
      </Button>
      <Text style={[text('caption'), { color: c.inkMuted }]}>
        Curves show the WHO 3rd, 50th and 97th percentiles. Your doctor is the best judge of how your baby is growing.
      </Text>
    </>
  );
}

function Checklist({ entries, birth }: { entries: Entry<'milestone'>[]; birth: Date | null }) {
  const { c, shadow } = useTheme();
  const done = new Map(
    entries
      .filter((e) => e.details.kind === 'developmental' && (e.details as { catalogId?: string }).catalogId)
      .map((e) => [(e.details as { catalogId: string }).catalogId, e]),
  );
  const now = useNow(3600_000);
  const ageMonths = birth ? (now.getTime() - birth.getTime()) / (30.44 * DAY) : null;
  return (
    <>
      <Text style={[text('caption'), { color: c.inkMuted }]}>
        What most babies do by each age. Every baby goes at their own pace, so talk to your doctor if something worries you.
      </Text>
      {CATALOG_AGES.map((months) => (
        <View key={months} style={styles.group}>
          <Text style={[styles.h2, { color: c.ink }]}>
            By {months} months{ageMonths !== null && ageMonths >= months - 1 && ageMonths < months + 2 ? ' · now' : ''}
          </Text>
          {MILESTONE_CATALOG.filter((m) => m.months === months).map((m) => {
            const entry = done.get(m.id);
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityState={{ checked: !!entry }}
                onPress={() =>
                  entry
                    ? router.push(`/entry/${entry.id}`)
                    : router.push(`/log/milestone?title=${encodeURIComponent(m.title)}&catalogId=${m.id}`)
                }
                style={[styles.row, shadow.soft, { backgroundColor: c.surface }]}
              >
                <View style={[styles.check, { borderColor: c.milestoneInk, backgroundColor: entry ? c.milestoneInk : 'transparent' }]}>
                  {entry ? <Text style={[styles.tick, { color: c.surface }]}>✓</Text> : null}
                </View>
                <Text style={[text('label'), styles.grow, { color: c.ink }]}>{m.title}</Text>
                {entry ? (
                  <Text style={[text('caption'), { color: c.inkMuted }]}>
                    {entry.startedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space[4], paddingTop: space[6], paddingBottom: 140, gap: space[3] },
  h1: font('display', 600, 30, 36),
  h2: font('display', 600, 18, 24),
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.md },
  well: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  card: { padding: space[4], borderRadius: radius.md, gap: space[2] },
  value: font('display', 600, 26, 32),
  group: { gap: space[2], marginTop: space[2] },
  check: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: font('sans', 800, 14, 18),
});
