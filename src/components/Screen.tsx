import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { font, radius, space, text, useTheme } from '@/theme';

/** A simple scrolling page for onboarding and settings-style screens. */
export function FormScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[text('display'), { color: c.ink }]}>{title}</Text>
          {subtitle ? <Text style={[text('body'), styles.subtitle, { color: c.inkMuted }]}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[text('label'), { color: c.ink }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.inkMuted}
        accessibilityLabel={label}
        {...input}
        style={[styles.input, { backgroundColor: c.surfaceSunken, color: c.ink }]}
      />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={[text('caption'), { color: c.danger }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space[4], paddingTop: space[8], gap: space[2] },
  subtitle: { marginTop: space[1] },
  body: { marginTop: space[6], gap: space[4] },
  field: { gap: space[2] },
  input: { ...font('sans', 600, 17, 22), minHeight: 52, paddingHorizontal: space[4], borderRadius: radius.sm },
});
