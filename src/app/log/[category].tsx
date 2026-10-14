import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/domain/categories';
import { activityColors, radius, space, text, useTheme } from '@/theme';

/** Log sheet. Phase 1 fills it with each category's form and timers. */
export default function LogSheet() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ category: string }>();
  const category: Category = (CATEGORIES as readonly string[]).includes(params.category) ? (params.category as Category) : 'feed';
  const info = CATEGORY_INFO[category];
  const { tint, ink } = activityColors(c, category);
  return (
    <View style={[styles.sheet, { backgroundColor: c.surface }]}>
      <View style={[styles.well, { backgroundColor: tint }]}>
        <Icon name={info.icon} size={28} color={ink} />
      </View>
      <Text style={[text('title'), { color: c.ink }]}>Log {info.label.toLowerCase()}</Text>
      <Text style={[text('body'), { color: c.inkMuted }]}>
        One-tap log sheets{info.timed ? ' and timers' : ''} for {info.label.toLowerCase()} arrive in Phase 1.
      </Text>
      <Button block variant="soft" onPress={() => router.back()}>
        Close
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, padding: space[6], gap: space[3], borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  well: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
