import { useState } from 'react';

import { Button } from '@/components';
import { ErrorText, Field, FormScreen } from '@/components/Screen';
import { useSession } from '@/state/session';

/** Accepts YYYY-MM-DD; a date picker replaces this field in Phase 1. */
function parseDate(s: string): string | null | undefined {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(new Date(`${t}T12:00:00`).getTime())) return undefined;
  return t;
}

export default function BabyStep() {
  const addBaby = useSession((s) => s.addBaby);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const birthDate = parseDate(birth);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await addBaby({ name, birthDate: birthDate ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScreen title="Add your baby" subtitle="You can add a photo and more babies later.">
      <Field label="Name" value={name} onChangeText={setName} placeholder="Mila" autoCapitalize="words" />
      <Field label="Birth date (optional)" value={birth} onChangeText={setBirth} placeholder="2026-06-01" keyboardType="numbers-and-punctuation" />
      <ErrorText>{birthDate === undefined ? 'Write the date as year-month-day, like 2026-06-01.' : error}</ErrorText>
      <Button block disabled={busy || !name.trim() || birthDate === undefined} onPress={submit}>
        Add baby
      </Button>
    </FormScreen>
  );
}
