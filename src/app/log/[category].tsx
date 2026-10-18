import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components';
import { EntryForm } from '@/components/EntryForm';
import { Segmented } from '@/components/form';
import { ErrorText } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useAppData } from '@/data/DataProvider';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/domain/categories';
import { draftDetails, draftEnd, draftProblem, newDraft, type Draft } from '@/domain/drafts';
import { doseWarning, nextDoseAt } from '@/domain/meds';
import { useBabyData } from '@/hooks/useBabyData';
import { useCanLog } from '@/state/session';
import { useNow } from '@/hooks/useNow';
import { remindNextDose } from '@/lib/reminders';
import { formatClock } from '@/lib/time';
import { activityColors, radius, space, text, useTheme } from '@/theme';

/** Log sheet: start a timer, or log something that already happened. */
export default function LogSheet() {
  const params = useLocalSearchParams<{ category: string; kind?: string; title?: string; catalogId?: string }>();
  const category: Category = (CATEGORIES as readonly string[]).includes(params.category) ? (params.category as Category) : 'feed';
  const { baby, entries, medications, ready } = useBabyData();
  const canLog = useCanLog();
  if (!canLog) return <ViewOnly category={category} />;

  if (!ready || !baby) return <Sheet title={`Log ${CATEGORY_INFO[category].label.toLowerCase()}`} category={category}>{null}</Sheet>;

  // A timer already running for this (perhaps started on another phone): show it instead of starting a second.
  const running = CATEGORY_INFO[category].timed
    ? entries.find((e) => e.category === category && e.endedAt === null)
    : undefined;
  if (running) return <Redirect href={`/timer/${running.id}`} />;

  const last = entries.find((e) => e.category === category);
  // Milestones tab links straight to growth, or to a catalogue item.
  const preset: Partial<Draft> =
    category === 'milestone' && params.kind === 'growth'
      ? { milestoneKind: 'growth' }
      : category === 'milestone' && params.title
        ? { milestoneKind: 'developmental', title: params.title, catalogId: params.catalogId ?? null }
        : {};
  return (
    <LogForm key={category} category={category} babyId={baby.id} last={last} entries={entries} medications={medications} preset={preset} />
  );
}

function ViewOnly({ category }: { category: Category }) {
  const { c } = useTheme();
  return (
    <Sheet title={CATEGORY_INFO[category].label} category={category}>
      <Text style={[text('body'), { color: c.inkMuted }]}>Viewers can see the log but not add to it. Ask the family owner if you&apos;d like to log too.</Text>
    </Sheet>
  );
}

function LogForm({
  category,
  babyId,
  last,
  entries,
  medications,
  preset,
}: {
  preset: Partial<Draft>;
  category: Category;
  babyId: string;
  last: ReturnType<typeof useBabyData>['entries'][number] | undefined;
  entries: ReturnType<typeof useBabyData>['entries'];
  medications: ReturnType<typeof useBabyData>['medications'];
}) {
  const { c } = useTheme();
  const data = useAppData()!;
  const now = useNow(15_000);
  const info = CATEGORY_INFO[category];
  const [draft, setDraft] = useState<Draft>(() => ({ ...newDraft(category, new Date(), last), ...preset }));
  const [mode, setMode] = useState<'timer' | 'past'>(info.timed ? 'timer' : 'past');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remind, setRemind] = useState(false);
  const change = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const problem = draftProblem(draft);
  const med = medications.find((m) => m.id === draft.medicationId);
  const warning = category === 'med' && med ? doseWarning(med, entries, draft.startedAt) : null;
  const { tint, ink } = activityColors(c, category);
  const nextDose = category === 'med' && med ? nextDoseAt(med, draft.startedAt) : null;

  async function run(fn: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  const startTimer = () =>
    run(async () => {
      const at = new Date();
      const details = draftDetails(draft) as Record<string, unknown>;
      if (category === 'feed' && draft.feedKind === 'breast') {
        details.segments = [{ side: draft.side, startedAt: at.toISOString() }];
      }
      const id = await data.startTimer(babyId, category, details as never, at);
      if (draft.note.trim()) await data.updateEntry(id, { note: draft.note });
      // The running entry now shows up in `entries`, and LogSheet redirects to its timer.
    });

  const save = () =>
    run(async () => {
      const id = await data.logEntry({
        babyId,
        category,
        details: draftDetails(draft) as never,
        startedAt: draft.startedAt,
        endedAt: draftEnd(draft, info.timed),
        note: draft.note,
        medicationId: category === 'med' ? draft.medicationId : null,
      });
      if (remind && med && nextDose) await remindNextDose(id, med.name, nextDose).catch(() => false);
      router.back();
    });

  const timerMode = info.timed && mode === 'timer';
  return (
    <Sheet
      title={`Log ${info.label.toLowerCase()}`}
      category={category}
      footer={
        <>
          <ErrorText>{error ?? (problem && !timerMode ? problem : null)}</ErrorText>
          {timerMode ? (
            <Button block onPress={startTimer} disabled={saving} testID="start-timer">
              Start timer
            </Button>
          ) : (
            <Button block onPress={save} disabled={saving || !!problem} testID="save-entry">
              Save
            </Button>
          )}
        </>
      }
    >
      {info.timed ? (
        <Segmented
          options={[
            { id: 'timer', label: 'Start now' },
            { id: 'past', label: 'Already done' },
          ]}
          value={mode}
          onChange={setMode}
        />
      ) : null}
      {warning ? (
        <View style={[styles.warning, { backgroundColor: warning.level === 'max' ? c.danger : tint }]} accessibilityLiveRegion="polite">
          <Text style={[text('caption'), { color: warning.level === 'max' ? c.surface : ink }]}>{warning.message}</Text>
        </View>
      ) : null}
      <EntryForm draft={draft} onChange={change} now={now} medications={medications} showTimes={!timerMode} />
      {nextDose && nextDose > now ? (
        <View style={styles.switchRow}>
          <Text style={[text('label'), styles.grow, { color: c.ink }]}>Remind me at {formatClock(nextDose)} when the next dose is allowed</Text>
          <Switch value={remind} onValueChange={setRemind} accessibilityLabel="Remind me when the next dose is allowed" />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  warning: { padding: space[3], borderRadius: radius.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  grow: { flex: 1 },
});
