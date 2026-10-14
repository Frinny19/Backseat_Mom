import { StyleSheet, Text, View } from 'react-native';

import { CATEGORY_INFO, type Category } from '@/domain/categories';
import { activityColors, font, radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type ActivityCardProps = {
  activity: Category;
  /** The what and the amount: "Bottle · 120 ml", "Nap · 1 h 25 m". */
  title: string;
  detail?: string;
  /** Clock time. */
  time: string;
  /** Relative time; only shown for the latest entry of each activity. */
  ago?: string;
  icon?: IconName;
};

/** One entry on the day's timeline. */
export function ActivityCard({ activity, title, detail, time, ago, icon }: ActivityCardProps) {
  const { c, shadow } = useTheme();
  const { tint, ink } = activityColors(c, activity);
  return (
    <View style={[styles.card, shadow.soft, { backgroundColor: c.surface }]} accessible accessibilityLabel={[title, detail, time, ago].filter(Boolean).join(', ')}>
      <View style={[styles.well, { backgroundColor: tint }]}>
        <Icon name={icon ?? CATEGORY_INFO[activity].icon} size={22} color={ink} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: c.inkMuted }]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text style={[styles.time, { color: c.ink }]}>{time}</Text>
        {ago ? <Text style={[styles.ago, { color: c.inkMuted }]}>{ago}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingLeft: space[3],
    paddingRight: space[4],
    borderRadius: radius.md,
  },
  well: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: font('sans', 800, 16, 22),
  detail: font('sans', 600, 13, 18),
  meta: { alignItems: 'flex-end' },
  time: { ...font('sans', 700, 14, 20), fontVariant: ['tabular-nums'] },
  ago: font('sans', 600, 12, 16),
});
