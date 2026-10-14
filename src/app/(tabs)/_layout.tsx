import { router, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBar, type TabId } from '@/components';
import { space } from '@/theme';

const ROUTE_FOR: Record<TabId, string> = { today: 'index', trends: 'trends', milestones: 'milestones', baby: 'baby' };
const TAB_FOR: Record<string, TabId> = { index: 'today', trends: 'trends', milestones: 'milestones', baby: 'baby' };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <View style={[styles.float, { bottom: Math.max(insets.bottom, space[4]) }]} pointerEvents="box-none">
          <TabBar
            active={TAB_FOR[state.routes[state.index].name] ?? 'today'}
            onChange={(id) => navigation.navigate(ROUTE_FOR[id])}
            onAdd={() => router.push('/log/feed')}
          />
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trends" />
      <Tabs.Screen name="milestones" />
      <Tabs.Screen name="baby" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  float: { position: 'absolute', left: space[4], right: space[4] },
});
