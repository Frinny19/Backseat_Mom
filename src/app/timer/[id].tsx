import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { EntryForm } from '@/components/EntryForm';
import { NoteField, TimeField } from '@/components/form';
import { ErrorText } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useAppData, useLive } from '@/data/DataProvider';
import { CATEGORY_INFO } from '@/domain/categories';
import { draftDetails, entryToDraft, type Draft } from '@/domain/drafts';
import type { Entry } from '@/domain/entries';
import { sideTotals } from '@/domain/timeline';
import { useBabyData } from '@/hooks/useBabyData';
import { useCanLog } from '@/state/session';
import { useNow } from '@/hooks/useNow';
import { formatClock, formatDuration, formatTimer } from '@/lib/time';
import { activityColors, font, radius, space, text, useTheme } from '@/theme';

/**
 * A running timer. It lives in the database (an entry with no end), so it keeps
 * going when the app closes and shows on every phone in the family.
 */
export default function TimerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useLive(['entries'], (d) => d.entry(id), [id], undefined as Entry | null | undefined);
  if (entry === undefined) return <Sheet title="Timer">{null}</Sheet>;
  if (!entry || entry.deletedAt) return <Gone message="This timer was discarded." />;
  if (entry.endedAt) return <Gone message={`Stopped at ${formatClock(entry.endedAt)}.`} />;
  return <Running key={entry.id} entry={entry} />;
}

function Gone({ message }: { message: string }) {
  const { c } = useTheme();
  return (
    <Sheet title="Timer" footer={<Button block onPress={() => router.back()}>Done</Button>}>
      <Text style={[text('body'), { color: c.inkMuted }]}>{message}</Text>
    </Sheet>
  );
}

function Running({ entry }: { entry: Entry }) {
  const { c } = useTheme();
  const data = useAppData()!;
  const now = useNow(1000);
  const { medications } = useBabyData();
  const canLog = useCanLog();
  const [draft, setDraft] = useState<Draft>(() => entryToDraft(entry));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tint, ink } = activityColors(c, entry.category);
  const info = CATEGORY_INFO[entry.category];
  const breast = entry.category === 'feed' && (entry.details as { kind: string }).kind === 'breast';
  const sides = breast ? sideTotals(entry.details, now) : null;

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

  const stop = () =>
    run(async () => {
      await data.stopTimer(entry.id);
      if (breast) {
        await data.updateEntry(entry.id, { note: draft.note });
      } else {
        const fresh = await data.entry(entry.id);
        await data.updateEntry(entry.id, { note: draft.note, details: draftDetails(draft, fresh?.details) });
      }
      router.back();
    });

  const discard = () =>
    run(async () => {
      await data.deleteEntry(entry.id);
      router.back();
    });

  const switchTo = (side: 'left' | 'right') => run(() => data.switchSide(entry.id, side));

  return (
    <Sheet
      title={info.label}
      subtitle={`Started ${formatClock(entry.startedAt)}`}
      category={entry.category}
      footer={
        !canLog ? undefined : <>
          <ErrorText>{error}</ErrorText>
          <Button block onPress={stop} disabled={busy} testID="stop-timer">
            Stop and save
          </Button>
          <Button block variant="ghost" onPress={discard} disabled={busy}>
            Discard
          </Button>
        </>
      }
    >
      <View style={[styles.clock, { backgroundColor: tint }]}>
        <Text style={[styles.time, { color: ink }]} accessibilityRole="timer" accessibilityLiveRegion="none">
          {formatTimer(entry.startedAt, now)}
        </Text>
        {sides ? (
          <Text style={[text('label'), { color: ink }]}>
            {sides.current ? `${sides.current === 'left' ? 'Left' : 'Right'} side now · ` : ''}L {formatDuration(sides.left)} · R{' '}
            {formatDuration(sides.right)}
          </Text>
        ) : null}
      </View>

      {sides && canLog ? (
        <View style={styles.sides}>
          {(['left', 'right'] as const).map((side) => (
            <View key={side} style={styles.side}>
              <Button
                block
                variant={sides.current === side ? 'primary' : 'soft'}
                onPress={() => switchTo(side)}
                disabled={busy || sides.current === side}
              >
                {sides.current === side ? `On ${side}` : `Switch to ${side}`}
              </Button>
            </View>
          ))}
        </View>
      ) : null}

      {canLog ? <TimeField
        label="Started"
        value={entry.startedAt}
        now={now}
        onChange={(startedAt) => run(() => data.updateEntry(entry.id, { startedAt }))}
      /> : null}

      {breast || !canLog ? null : (
        <EntryForm draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} now={now} medications={medications} showTimes={false} />
      )}
      {breast && canLog ? <NoteField value={draft.note} onChangeText={(note) => setDraft((d) => ({ ...d, note }))} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  clock: { alignItems: 'center', paddingVertical: space[6], borderRadius: radius.lg, gap: space[2] },
  time: { ...font('display', 600, 56, 64), fontVariant: ['tabular-nums'] },
  sides: { flexDirection: 'row', gap: space[2] },
  side: { flex: 1 },
});
