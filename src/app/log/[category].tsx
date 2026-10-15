import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { EntryForm } from '@/components/EntryForm';
import { Segmented } from '@/components/form';
import { ErrorText } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useAppData } from '@/data/DataProvider';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/domain/categories';
import { draftDetails, draftEnd, draftProblem, newDraft, type Draft } from '@/domain/drafts';
import { doseWarning } from '@/domain/meds';
import { useBabyData } from '@/hooks/useBabyData';
import { useNow } from '@/hooks/useNow';
import { activityColors, radius, space, text, useTheme } from '@/theme';

/** Log sheet: start a timer, or log something that already happened. */
export default function LogSheet() {
  const params = useLocalSearchParams<{ category: string }>();
  const category: Category = (CATEGORIES as readonly string[]).includes(params.category) ? (params.category as Category) : 'feed';
  const { baby, entries, medications, ready } = useBabyData();

  if (!ready || !baby) return <Sheet title={`Log ${CATEGORY_INFO[category].label.toLowerCase()}`} category={category}>{null}</Sheet>;

  // A timer already running for this (perhaps started on another phone): show it instead of starting a second.
  const running = CATEGORY_INFO[category].timed
    ? entries.find((e) => e.category === category && e.endedAt === null)
    : undefined;
  if (running) return <Redirect href={`/timer/${running.id}`} />;

  const last = entries.find((e) => e.category === category);
  return <LogForm key={category} category={category} babyId={baby.id} last={last} entries={entries} medications={medications} />;
}

function LogForm({
  category,
  babyId,
  last,
  entries,
  medications,
}: {
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
  const [draft, setDraft] = useState<Draft>(() => newDraft(category, new Date(), last));
  const [mode, setMode] = useState<'timer' | 'past'>(info.timed ? 'timer' : 'past');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const problem = draftProblem(draft);
  const med = medications.find((m) => m.id === draft.medicationId);
  const warning = category === 'med' && med ? doseWarning(med, entries, draft.startedAt) : null;
  const { tint, ink } = activityColors(c, category);

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
      await data.logEntry({
        babyId,
        category,
        details: draftDetails(draft) as never,
        startedAt: draft.startedAt,
        endedAt: draftEnd(draft, info.timed),
        note: draft.note,
        medicationId: category === 'med' ? draft.medicationId : null,
      });
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
        <View style={[styles.warning, { backgroundColor: tint }]}>
          <Text style={[text('caption'), { color: ink }]}>{warning}</Text>
        </View>
      ) : null}
      <EntryForm draft={draft} onChange={change} now={now} medications={medications} showTimes={!timerMode} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  warning: { padding: space[3], borderRadius: radius.sm },
});
