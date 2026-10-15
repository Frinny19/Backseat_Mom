import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components';
import { Label, Stepper, TextField } from '@/components/form';
import { ErrorText } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useAppData } from '@/data/DataProvider';
import { useBabyData } from '@/hooks/useBabyData';
import { radius, space, text, useTheme } from '@/theme';

/** The baby's medications, with the usual dose and how often it can be given. */
export default function Medications() {
  const { c, shadow } = useTheme();
  const data = useAppData();
  const { baby, medications } = useBabyData();
  const [name, setName] = useState('');
  const [dose, setDose] = useState(2.5);
  const [unit, setUnit] = useState('ml');
  const [gap, setGap] = useState(4);
  const [max, setMax] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!data || !baby) return;
    setError(null);
    try {
      await data.addMedication({
        babyId: baby.id,
        name,
        defaultDose: dose || null,
        unit: unit.trim() || null,
        minIntervalHours: gap || null,
        maxDosesPerDay: max || null,
      });
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Sheet title="Medications" subtitle={baby ? `For ${baby.name}` : undefined}>
      {medications.map((m) => (
        <View key={m.id} style={[styles.row, shadow.soft, { backgroundColor: c.surface }]}>
          <View style={styles.body}>
            <Text style={[text('label'), { color: c.ink }]}>{m.name}</Text>
            <Text style={[text('caption'), { color: c.inkMuted }]}>
              {[
                m.defaultDose ? `${m.defaultDose} ${m.unit ?? ''}`.trim() : null,
                m.minIntervalHours ? `every ${m.minIntervalHours} h` : null,
                m.maxDosesPerDay ? `max ${m.maxDosesPerDay} a day` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'No usual dose set'}
            </Text>
          </View>
          <Switch
            value={m.active}
            onValueChange={(active) => data?.updateMedication(m.id, { active })}
            accessibilityLabel={`${m.name} in use`}
          />
        </View>
      ))}

      <Text style={[text('title'), { color: c.ink }]}>Add a medication</Text>
      <TextField label="Name" placeholder="Tylenol" value={name} onChangeText={setName} />
      <View>
        <Label>Usual dose</Label>
        <Stepper label="Usual dose" value={dose} onChange={setDose} step={0.5} unit={unit} />
      </View>
      <TextField label="Unit" value={unit} onChangeText={setUnit} autoCapitalize="none" />
      <View>
        <Label>Hours between doses (0 for no limit)</Label>
        <Stepper label="Hours between doses" value={gap} onChange={setGap} step={1} unit="h" />
      </View>
      <View>
        <Label>Most doses in a day (0 for no limit)</Label>
        <Stepper label="Most doses in a day" value={max} onChange={setMax} step={1} />
      </View>
      <ErrorText>{error}</ErrorText>
      <Button block onPress={add} disabled={!name.trim()}>
        Add medication
      </Button>
      <Text style={[text('caption'), { color: c.inkMuted }]}>
        Backseat Mom warns when a dose looks early, but it doesn&apos;t replace advice from your doctor or pharmacist.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.md },
  body: { flex: 1 },
});
