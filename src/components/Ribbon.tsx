import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_INFO, type Category } from '@/domain/categories';
import { activityColors, font, radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type RibbonChipProps = {
  activity: Category;
  label: string;
  /** "2 h 15 m ago", "Never", or the running timer when `active`. */
  time: string;
  detail?: string;
  active?: boolean;
  never?: boolean;
  icon?: IconName;
  onPress?: () => void;
  onLongPress?: () => void;
};

export type RibbonProps = {
  items: RibbonChipProps[];
  /** Opens the sheet to hide, show and reorder categories. Pass false to hide the Edit chip. */
  onEdit?: (() => void) | false;
};

function LiveDot({ color }: { color: string }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return <Animated.View style={[styles.live, { backgroundColor: color, opacity }]} />;
}

/** One category on the ribbon: idle, active (live timer) or never logged. */
export function RibbonChip({ activity, label, time, detail, active, never, icon, onPress, onLongPress }: RibbonChipProps) {
  const { c, shadow } = useTheme();
  const { tint, ink } = activityColors(c, activity);
  const line = detail ? `${label} · ${detail}` : label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${active ? `running ${time}` : time}${detail ? `, ${detail}` : ''}`}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={`ribbon-chip-${activity}`}
      style={({ pressed }) => [
        styles.chip,
        shadow.soft,
        { backgroundColor: active ? tint : c.surface },
        active && { borderWidth: 2, borderColor: ink },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.well, { backgroundColor: active ? c.surface : tint }]}>
        <Icon name={icon ?? CATEGORY_INFO[activity].icon} size={20} color={ink} />
      </View>
      <View>
        <View style={styles.timeRow}>
          {active ? <LiveDot color={ink} /> : null}
          <Text
            style={[styles.time, { color: active ? ink : never ? c.inkMuted : c.ink }, never && styles.timeNever]}
            numberOfLines={1}
          >
            {time}
          </Text>
        </View>
        <Text style={[styles.detail, { color: active ? ink : c.inkMuted }]} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </Pressable>
  );
}

/** The strip pinned to the top of Today. Scrolls sideways when it doesn't fit. */
export function Ribbon({ items, onEdit }: RibbonProps) {
  const { c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      accessibilityRole="list"
      accessibilityLabel="Last activity"
    >
      {items.map((it) => (
        <RibbonChip key={it.activity} {...it} />
      ))}
      {onEdit !== false ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose categories"
          onPress={onEdit || undefined}
          style={({ pressed }) => [styles.chip, styles.edit, { backgroundColor: c.surfaceSunken }, pressed && styles.pressed]}
        >
          <Icon name="sliders" size={20} color={c.inkMuted} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space[2], paddingHorizontal: space[4], paddingTop: space[1], paddingBottom: space[3] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 56,
    paddingVertical: space[2],
    paddingLeft: space[2],
    paddingRight: 14,
    borderRadius: radius.md,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  well: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { ...font('sans', 800, 15, 20), fontVariant: ['tabular-nums'] },
  timeNever: font('sans', 700, 15, 20),
  detail: font('sans', 600, 12, 16),
  live: { width: 8, height: 8, borderRadius: radius.pill },
  edit: { width: 56, justifyContent: 'center', paddingLeft: 0, paddingRight: 0 },
});
