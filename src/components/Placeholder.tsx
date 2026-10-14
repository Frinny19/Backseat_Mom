import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, text, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

/** A screen that exists in navigation but whose content comes in a later phase. */
export function Placeholder({ title, body, icon, children }: { title: string; body: string; icon: IconName; children?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <Icon name={icon} size={32} color={c.sleepInk} />
        <Text style={[text('title'), { color: c.ink }]}>{title}</Text>
        <Text style={[text('body'), { color: c.inkMuted }]}>{body}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space[4], paddingTop: space[8], gap: space[3] },
});
