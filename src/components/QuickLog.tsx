import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_INFO, type Category } from '@/domain/categories';
import { activityColors, font, radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type QuickLogProps = {
  activity: Category;
  label: string;
  /** Context for the next decision: "Right next", "Awake 1 h 40", "3 wet". */
  sub?: string;
  icon?: IconName;
  onPress?: () => void;
};

/** Big colourful tile on Today: one tap starts a log. */
export function QuickLog({ activity, label, sub, icon, onPress }: QuickLogProps) {
  const { c } = useTheme();
  const { tint, ink } = activityColors(c, activity);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `Log ${label}, ${sub}` : `Log ${label}`}
      onPress={onPress}
      testID={`quick-log-${activity}`}
      style={({ pressed }) => [styles.tile, { backgroundColor: tint }, pressed && styles.pressed]}
    >
      <View style={[styles.well, { backgroundColor: c.surface }]}>
        <Icon name={icon ?? CATEGORY_INFO[activity].icon} size={26} color={ink} />
      </View>
      <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.sub, { color: ink }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
    paddingTop: space[3],
    paddingHorizontal: space[3],
    paddingBottom: space[4],
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  pressed: { transform: [{ scale: 0.96 }] },
  well: {
    width: 44,
    height: 44,
    marginBottom: space[2],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: font('sans', 800, 15, 20),
  sub: font('sans', 600, 12, 16),
});
