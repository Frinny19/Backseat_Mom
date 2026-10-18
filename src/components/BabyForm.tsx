import { useState } from 'react';
import { View } from 'react-native';

import type { Baby } from '@/state/session';

import { Button } from './Button';
import { DateField, Label, Segmented, TextField } from './form';
import { ErrorText } from './Screen';

export type BabyInput = { name: string; birthDate: string | null; sex: Baby['sex'] };

const SEXES = [
  { id: 'female', label: 'Girl' },
  { id: 'male', label: 'Boy' },
  { id: 'other', label: 'Not set' },
] as const;

const iso = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

/** Name, birth date and sex. Sex picks the WHO growth curves. */
export function BabyForm({ baby, submitLabel, onSubmit }: { baby?: Baby; submitLabel: string; onSubmit: (b: BabyInput) => Promise<void> }) {
  const [name, setName] = useState(baby?.name ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(iso(baby?.birthDate ?? null));
  const [sex, setSex] = useState<'female' | 'male' | 'other'>(baby?.sex ?? 'other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badDate = !!birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(new Date(`${birthDate}T12:00:00`).getTime()));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), birthDate, sex: sex === 'other' ? null : sex });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Mila" autoCapitalize="words" />
      <DateField label="Birth date" value={birthDate} onChange={setBirthDate} />
      <View>
        <Label>Sex (for growth charts)</Label>
        <Segmented options={[...SEXES]} value={sex} onChange={setSex} />
      </View>
      <ErrorText>{badDate ? 'Write the date as year-month-day, like 2026-06-01.' : error}</ErrorText>
      <Button block disabled={busy || !name.trim() || badDate} onPress={submit}>
        {submitLabel}
      </Button>
    </View>
  );
}
