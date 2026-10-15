import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Category } from '@/domain/categories';
import { CATEGORY_INFO } from '@/domain/categories';
import { activityColors, font, radius, space, text, useTheme } from '@/theme';

import { Icon } from './Icon';

/** A sheet or pushed page: header with an optional category badge, scrolling body, pinned footer. */
export function Sheet({
  title,
  subtitle,
  category,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  category?: Category;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = category ? activityColors(c, category) : null;
  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? space[6] : insets.top + space[3] }]}>
        {category && colors ? (
          <View style={[styles.well, { backgroundColor: colors.tint }]}>
            <Icon name={CATEGORY_INFO[category].icon} size={24} color={colors.ink} />
          </View>
        ) : null}
        <View style={styles.titles}>
          <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={[text('caption'), { color: c.inkMuted }]}>{subtitle}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.close, { backgroundColor: c.surfaceSunken }]}
          hitSlop={8}
        >
          <Text style={[styles.closeText, { color: c.ink }]}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]), borderTopColor: c.border, backgroundColor: c.bg }]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingBottom: space[3] },
  well: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1 },
  title: font('display', 600, 24, 30),
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  closeText: font('sans', 700, 16, 20),
  body: { paddingHorizontal: space[4], paddingBottom: space[6], gap: space[4] },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], gap: space[2], borderTopWidth: StyleSheet.hairlineWidth },
});
