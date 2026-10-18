import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Icon } from '@/components';
import { Chips, Label } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { useAppData } from '@/data/DataProvider';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/domain/categories';
import type { RibbonPrefs } from '@/domain/ribbon';
import { useBabyData } from '@/hooks/useBabyData';
import { activityColors, font, radius, space, text, useTheme } from '@/theme';

const DUE_CATEGORIES: Category[] = ['feed', 'diaper', 'sleep', 'pump'];
const DUE_HOURS = [0, 2, 3, 4, 6];

/** Full order, hidden ones included, so they can be moved too. */
function fullOrder(prefs: RibbonPrefs): Category[] {
  const order = prefs.order.filter((c) => CATEGORIES.includes(c));
  for (const c of CATEGORIES) if (!order.includes(c)) order.push(c);
  return order;
}

/** Each person picks which categories show on their ribbon and in what order. */
export default function RibbonSettings() {
  const { c, shadow } = useTheme();
  const data = useAppData();
  const { baby, prefs } = useBabyData();
  const order = fullOrder(prefs);

  const save = (next: RibbonPrefs) => {
    if (data && baby) data.setRibbonPrefs(baby.id, next);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    save({ ...prefs, order: next });
  };
  const toggle = (cat: Category, show: boolean) => {
    const hidden = show ? prefs.hidden.filter((h) => h !== cat) : [...prefs.hidden, cat];
    if (hidden.length === CATEGORIES.length) return; // Keep at least one.
    save({ order, hidden });
  };

  return (
    <Sheet title="Edit ribbon" subtitle="Only changes your ribbon. Everyone else keeps theirs.">
      {order.map((cat, i) => {
        const { tint, ink } = activityColors(c, cat);
        const shown = !prefs.hidden.includes(cat);
        return (
          <View key={cat} style={[styles.row, shadow.soft, { backgroundColor: c.surface, opacity: shown ? 1 : 0.6 }]}>
            <View style={[styles.well, { backgroundColor: tint }]}>
              <Icon name={CATEGORY_INFO[cat].icon} size={20} color={ink} />
            </View>
            <Text style={[text('label'), styles.name, { color: c.ink }]}>{CATEGORY_INFO[cat].label}</Text>
            <Arrow label={`Move ${CATEGORY_INFO[cat].label} up`} glyph="↑" disabled={i === 0} onPress={() => move(i, -1)} />
            <Arrow label={`Move ${CATEGORY_INFO[cat].label} down`} glyph="↓" disabled={i === order.length - 1} onPress={() => move(i, 1)} />
            <Switch value={shown} onValueChange={(v) => toggle(cat, v)} accessibilityLabel={`Show ${CATEGORY_INFO[cat].label}`} />
          </View>
        );
      })}
      <Text style={[text('caption'), { color: c.inkMuted }]}>Tip: long-press a chip on the ribbon to hide it.</Text>

      <Text style={[text('title'), { color: c.ink }]}>Due hints</Text>
      <Text style={[text('caption'), { color: c.inkMuted }]}>
        A chip changes colour when it has been this long since the last one. Only you see your hints.
      </Text>
      {DUE_CATEGORIES.map((cat) => {
        const { tint, ink } = activityColors(c, cat);
        const current = prefs.due?.[cat];
        return (
          <View key={cat}>
            <Label>{CATEGORY_INFO[cat].label}</Label>
            <Chips
              options={DUE_HOURS.map((h) => ({ id: String(h), label: h === 0 ? 'Off' : `${h} h` }))}
              value={String(current ?? 0)}
              onChange={(v) => {
                const hours = Number(v ?? 0);
                const due = { ...prefs.due };
                if (hours) due[cat] = hours;
                else delete due[cat];
                save({ ...prefs, order, due });
              }}
              tint={tint}
              ink={ink}
            />
          </View>
        );
      })}
    </Sheet>
  );
}

function Arrow({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.arrow, { backgroundColor: c.surfaceSunken, opacity: disabled ? 0.3 : 1 }]}
    >
      <Text style={[styles.glyph, { color: c.ink }]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[3], borderRadius: radius.md },
  well: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1 },
  arrow: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  glyph: font('sans', 800, 16, 20),
});
