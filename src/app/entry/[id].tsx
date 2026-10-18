import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { EntryForm } from '@/components/EntryForm';
import { Label } from '@/components/form';
import { ErrorText } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useAppData, useLive } from '@/data/DataProvider';
import { fetchHistory } from '@/data/history';
import { CATEGORY_INFO } from '@/domain/categories';
import { draftDetails, draftEnd, draftProblem, entryToDraft, type Draft } from '@/domain/drafts';
import type { Entry } from '@/domain/entries';
import { describeChange, type HistoryRow } from '@/domain/history';
import { useBabyData } from '@/hooks/useBabyData';
import { useNow } from '@/hooks/useNow';
import { cancelReminder } from '@/lib/reminders';
import { formatAgo, formatClock } from '@/lib/time';
import { space, text, useTheme } from '@/theme';

/** Edit or delete an entry, and see who changed it. */
export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useLive(['entries'], (d) => d.entry(id), [id], undefined as Entry | null | undefined);
  if (entry === undefined) return <Sheet title="Entry">{null}</Sheet>;
  if (!entry) return <Sheet title="Entry">{null}</Sheet>;
  // Running timers are edited on the timer screen.
  if (entry.endedAt === null && CATEGORY_INFO[entry.category].timed && !entry.deletedAt) {
    return <Redirect href={`/timer/${entry.id}`} />;
  }
  return <EditEntry key={entry.id} entry={entry} />;
}

function EditEntry({ entry }: { entry: Entry }) {
  const { c } = useTheme();
  const data = useAppData()!;
  const now = useNow(30_000);
  const { medications, names } = useBabyData();
  const [draft, setDraft] = useState<Draft>(() => entryToDraft(entry));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const info = CATEGORY_INFO[entry.category];
  const problem = draftProblem(draft);

  useEffect(() => {
    let cancelled = false;
    fetchHistory(entry.id)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [entry.id, entry.deletedAt]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const save = () =>
    run(() =>
      data.updateEntry(entry.id, {
        startedAt: draft.startedAt,
        endedAt: draftEnd(draft, info.timed),
        note: draft.note,
        medicationId: entry.category === 'med' ? draft.medicationId : undefined,
        details: draftDetails(draft, entry.details),
      }),
    );

  const by = (id: string | null | undefined) => (id ? (names[id] ?? 'Someone') : 'Someone');

  if (entry.deletedAt) {
    return (
      <Sheet
        title={info.label}
        category={entry.category}
        subtitle={`Deleted ${formatAgo(entry.deletedAt, now)}`}
        footer={
          <Button block onPress={() => run(() => data.restoreEntry(entry.id))} disabled={busy}>
            Restore
          </Button>
        }
      >
        <Text style={[text('body'), { color: c.inkMuted }]}>This entry is in Recently deleted. Restore it to edit it.</Text>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={`Edit ${info.label.toLowerCase()}`}
      category={entry.category}
      subtitle={`Logged by ${by(entry.createdBy)}`}
      footer={
        <>
          <ErrorText>{error ?? problem}</ErrorText>
          <Button block onPress={save} disabled={busy || !!problem} testID="save-entry">
            Save changes
          </Button>
          <Button block variant="ghost" onPress={() => run(async () => {
            await cancelReminder(entry.id);
            await data.deleteEntry(entry.id);
          })} disabled={busy} testID="delete-entry">
            Delete
          </Button>
        </>
      }
    >
      <EntryForm draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} now={now} medications={medications} />
      {history?.length ? (
        <View style={styles.history}>
          <Label>History</Label>
          {history.map((h) => (
            <Text key={h.id} style={[text('caption'), { color: c.inkMuted }]}>
              {describeChange(h)} by {by(h.changedBy)} · {formatAgo(h.changedAt, now)} ({formatClock(h.changedAt)})
            </Text>
          ))}
        </View>
      ) : null}
      <Text style={[text('caption'), { color: c.inkMuted }]}>Deleted entries stay in Recently deleted for 30 days.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  history: { gap: space[1] },
});
