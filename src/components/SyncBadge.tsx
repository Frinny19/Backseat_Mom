import { StyleSheet, Text, View } from 'react-native';

import { useSyncStatus } from '@/data/DataProvider';
import { radius, space, text, useTheme } from '@/theme';

/** Says when changes are waiting to reach the family, and stays out of the way otherwise. */
export function SyncBadge() {
  const { c } = useTheme();
  const s = useSyncStatus();
  if (!s) return null;
  let label: string | null = null;
  if (!s.online) label = s.pending ? `Offline · ${s.pending} saved on this phone` : 'Offline';
  else if (s.rejected) label = `${s.rejected} change${s.rejected === 1 ? '' : 's'} couldn't be saved`;
  else if (s.pending && s.syncing) label = 'Syncing…';
  if (!label) return null;
  return (
    <View style={[styles.badge, { backgroundColor: c.surfaceSunken }]} accessibilityLiveRegion="polite">
      <Text style={[text('caption'), { color: s.rejected && s.online ? c.danger : c.inkMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.pill, marginTop: space[1] },
});
