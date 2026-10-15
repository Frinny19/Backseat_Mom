import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { Sheet } from '@/components/Sheet';
import { useAppData, useLive } from '@/data/DataProvider';
import type { Entry } from '@/domain/entries';
import { entryTitle } from '@/domain/timeline';
import { useBabyData } from '@/hooks/useBabyData';
import { formatAgo, formatClock } from '@/lib/time';
import { radius, space, text, useTheme } from '@/theme';

const NONE: Entry[] = [];

/** Entries deleted in the last 30 days. Anyone in the family can bring one back. */
export default function RecentlyDeleted() {
  const { c, shadow } = useTheme();
  const data = useAppData();
  const { medicationNames, names } = useBabyData();
  const deleted = useLive(['entries'], (d) => d.recentlyDeleted(), [], NONE);
  const now = new Date();

  return (
    <Sheet title="Recently deleted" subtitle="Kept for 30 days, then removed for good">
      {deleted.length === 0 ? <Text style={[text('body'), { color: c.inkMuted }]}>Nothing deleted recently.</Text> : null}
      {deleted.map((e) => (
        <View key={e.id} style={[styles.row, shadow.soft, { backgroundColor: c.surface }]}>
          <View style={styles.body}>
            <Text style={[text('label'), { color: c.ink }]}>{entryTitle(e, e.medicationId ? medicationNames[e.medicationId] : undefined)}</Text>
            <Text style={[text('caption'), { color: c.inkMuted }]}>
              From {e.startedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {formatClock(e.startedAt)} · deleted{' '}
              {formatAgo(e.deletedAt!, now).toLowerCase()}
              {e.updatedBy ? ` by ${names[e.updatedBy] ?? 'someone'}` : ''}
            </Text>
          </View>
          <Button variant="soft" onPress={() => data?.restoreEntry(e.id)}>
            Restore
          </Button>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.md },
  body: { flex: 1 },
});
