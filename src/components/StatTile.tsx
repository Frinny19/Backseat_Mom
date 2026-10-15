import { StyleSheet, Text, View } from 'react-native';

import { CATEGORY_INFO, type Category } from '@/domain/categories';
import { activityColors, font, radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type StatTileProps = {
  activity: Category;
  label: string;
  value: string;
  /** 0 to 1 toward a daily goal; leave out when there is no goal. */
  progress?: number;
  icon?: IconName;
};

/** Today's total for one activity. */
export function StatTile({ activity, label, value, progress, icon }: StatTileProps) {
  const { c } = useTheme();
  const { tint, ink } = activityColors(c, activity);
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : null;
  return (
    <View style={[styles.tile, { backgroundColor: tint }]} accessible accessibilityLabel={`${label}, ${value}`}>
      <View style={styles.top}>
        <Icon name={icon ?? CATEGORY_INFO[activity].icon} size={18} color={ink} />
        <Text style={[styles.label, { color: ink }]}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: ink }]}>{value}</Text>
      {pct !== null ? (
        <View
          style={[styles.track, { backgroundColor: c.surface }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
        >
          <View style={[styles.fill, { backgroundColor: ink, width: `${pct * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, paddingTop: space[3], paddingHorizontal: space[3], paddingBottom: space[4], borderRadius: radius.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  label: font('sans', 700, 13, 18),
  value: { ...font('display', 600, 24, 28), marginTop: space[2], fontVariant: ['tabular-nums'] },
  track: { marginTop: space[2], height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
