import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { font, radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type ButtonProps = {
  variant?: 'primary' | 'soft' | 'ghost';
  icon?: IconName;
  block?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
  testID?: string;
};

/** Pill button, at least 48px tall. Labels are verbs in sentence case. */
export function Button({ variant = 'primary', icon, block, disabled, onPress, children, testID }: ButtonProps) {
  const { c, shadow } = useTheme();
  const fg = variant === 'primary' ? c.onPrimary : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        block && styles.block,
        variant === 'primary' && [{ backgroundColor: pressed ? c.primaryPressed : c.primary }, shadow.soft],
        variant === 'soft' && { backgroundColor: c.surfaceSunken },
        variant === 'ghost' && { backgroundColor: 'transparent', borderWidth: 2, borderColor: c.inkMuted },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.row}>
        {icon ? <Icon name={icon} size={20} color={fg} /> : null}
        <Text style={[styles.label, { color: fg }]}>{children}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: space[6],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: font('sans', 700, 15, 20),
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
});
