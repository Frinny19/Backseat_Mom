import { Pressable, StyleSheet, Text, View } from 'react-native';

import { font, radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type TabId = 'today' | 'trends' | 'milestones' | 'baby';

const TABS: { id: TabId | 'add'; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'trends', label: 'Trends', icon: 'chart' },
  { id: 'add', label: 'Log', icon: 'plus' },
  { id: 'milestones', label: 'Milestones', icon: 'star' },
  { id: 'baby', label: 'Baby', icon: 'user' },
];

export type TabBarProps = {
  active: TabId;
  onChange?: (id: TabId) => void;
  onAdd?: () => void;
};

/** Floating bottom navigation with a raised coral Log button. */
export function TabBar({ active, onChange, onAdd }: TabBarProps) {
  const { c, shadow } = useTheme();
  return (
    <View style={[styles.bar, shadow.float, { backgroundColor: c.surface }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        if (t.id === 'add') {
          if (!onAdd) return <View key={t.id} style={styles.cell} />;
          return (
            <View key={t.id} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log activity"
                onPress={onAdd}
                testID="tab-add"
                style={({ pressed }) => [styles.add, shadow.float, { backgroundColor: pressed ? c.primaryPressed : c.primary }]}
              >
                <Icon name="plus" size={26} color={c.onPrimary} />
              </Pressable>
            </View>
          );
        }
        const isActive = t.id === active;
        const id = t.id;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange?.(id)}
            testID={`tab-${id}`}
            style={[styles.cell, styles.tab]}
          >
            <Icon name={t.icon} size={22} color={isActive ? c.sleepInk : c.inkMuted} />
            <Text style={[styles.label, { color: isActive ? c.ink : c.inkMuted }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', padding: space[2], borderRadius: radius.lg },
  cell: { flex: 1, alignItems: 'center' },
  tab: { minHeight: 48, justifyContent: 'center', gap: 2, borderRadius: radius.sm },
  label: font('sans', 700, 11, 14),
  add: { width: 56, height: 56, marginTop: -24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
