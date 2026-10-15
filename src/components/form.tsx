import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { formatClock } from '@/lib/time';
import { font, radius, space, text, useTheme } from '@/theme';

/** Small building blocks for the log sheets: segmented choices, chips, numbers, times, notes. */

export function Label({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <Text style={[text('label'), styles.label, { color: c.ink }]}>{children}</Text>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tint,
  ink,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  tint?: string;
  ink?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surfaceSunken }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[styles.segment, on && { backgroundColor: tint ?? c.surface }]}
            testID={`segment-${o.id}`}
          >
            <Text style={[styles.segmentText, { color: on ? (ink ?? c.ink) : c.inkMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  tint,
  ink,
}: {
  options: { id: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  tint: string;
  ink: string;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(on ? null : o.id)}
            style={[styles.chip, { backgroundColor: on ? tint : c.surfaceSunken }, on && { borderColor: ink }]}
          >
            <Text style={[styles.chipText, { color: on ? ink : c.ink }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A number with − and + buttons, for amounts. */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  unit,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  unit?: string;
  label: string;
}) {
  const { c } = useTheme();
  const round = (v: number) => Math.round(v * 100) / 100;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Less ${label}`}
        onPress={() => onChange(Math.max(min, round(value - step)))}
        style={[styles.stepBtn, { backgroundColor: c.surfaceSunken }]}
      >
        <Text style={[styles.stepBtnText, { color: c.ink }]}>−</Text>
      </Pressable>
      <TextInput
        accessibilityLabel={label}
        value={String(value)}
        onChangeText={(t) => {
          const n = Number(t.replace(',', '.'));
          if (!Number.isNaN(n)) onChange(n);
        }}
        keyboardType="decimal-pad"
        style={[styles.stepValue, { color: c.ink }]}
      />
      {unit ? <Text style={[text('label'), { color: c.inkMuted }]}>{unit}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More ${label}`}
        onPress={() => onChange(round(value + step))}
        style={[styles.stepBtn, { backgroundColor: c.surfaceSunken }]}
      >
        <Text style={[styles.stepBtnText, { color: c.ink }]}>+</Text>
      </Pressable>
    </View>
  );
}

const QUICK_MINUTES = [0, 5, 15, 30, 60];

/** When something happened: now, a quick "x min ago", or a picked time. */
export function TimeField({ label, value, onChange, now }: { label: string; value: Date; onChange: (d: Date) => void; now: Date }) {
  const { c } = useTheme();
  const agoMin = Math.round((now.getTime() - value.getTime()) / 60_000);

  function pick() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        onValueChange: (_e, d) => {
          const next = new Date(value);
          next.setHours(d.getHours(), d.getMinutes(), 0, 0);
          // A time later than now means yesterday (logging a night feed after midnight).
          if (next.getTime() > now.getTime()) next.setDate(next.getDate() - 1);
          onChange(next);
        },
      });
    }
  }

  return (
    <View>
      <Label>{label}</Label>
      <View style={styles.chips}>
        {QUICK_MINUTES.map((m) => {
          const on = Math.abs(agoMin - m) < 1;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(new Date(now.getTime() - m * 60_000))}
              style={[styles.chip, { backgroundColor: on ? c.ink : c.surfaceSunken }]}
            >
              <Text style={[styles.chipText, { color: on ? c.surface : c.ink }]}>{m === 0 ? 'Now' : `${m} min ago`}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.timeRow}>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            maximumDate={now}
            onValueChange={(_e, d) => onChange(d)}
          />
        ) : (
          <Pressable accessibilityRole="button" onPress={pick} style={[styles.chip, { backgroundColor: c.surfaceSunken }]}>
            <Text style={[styles.chipText, { color: c.ink }]}>{formatClock(value)} · Change</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function NoteField(props: TextInputProps) {
  const { c } = useTheme();
  return (
    <TextInput
      placeholder="Add a note"
      placeholderTextColor={c.inkMuted}
      multiline
      accessibilityLabel="Note"
      {...props}
      style={[styles.note, { backgroundColor: c.surfaceSunken, color: c.ink }]}
    />
  );
}

export function TextField(props: TextInputProps & { label: string }) {
  const { c } = useTheme();
  const { label, ...rest } = props;
  return (
    <View>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={c.inkMuted}
        accessibilityLabel={label}
        {...rest}
        style={[styles.input, { backgroundColor: c.surfaceSunken, color: c.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: space[2] },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentText: font('sans', 700, 14, 20),
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 40,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipText: font('sans', 700, 14, 20),
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  stepBtn: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: font('sans', 800, 24, 28),
  stepValue: { ...font('display', 600, 28, 34), minWidth: 72, textAlign: 'center', fontVariant: ['tabular-nums'] },
  timeRow: { marginTop: space[2], flexDirection: 'row' },
  note: { ...font('sans', 400, 16, 22), minHeight: 72, padding: space[3], borderRadius: radius.sm, textAlignVertical: 'top' },
  input: { ...font('sans', 600, 17, 22), minHeight: 52, paddingHorizontal: space[4], borderRadius: radius.sm },
});
