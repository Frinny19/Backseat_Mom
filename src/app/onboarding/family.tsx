import { useState } from 'react';

import { Button } from '@/components';
import { ErrorText, Field, FormScreen } from '@/components/Screen';
import { useSession } from '@/state/session';

export default function FamilyStep() {
  const createFamily = useSession((s) => s.createFamily);
  const joinFamily = useSession((s) => s.joinFamily);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') await createFamily(value.trim());
      else await joinFamily(value.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return mode === 'create' ? (
    <FormScreen title="Start your family" subtitle="Everyone you invite can see and log entries for your baby.">
      <Field label="Family name" value={value} onChangeText={setValue} placeholder="The Koehlers" autoCapitalize="words" />
      <ErrorText>{error}</ErrorText>
      <Button block disabled={busy || !value.trim()} onPress={submit}>
        Create family
      </Button>
      <Button variant="ghost" block onPress={() => { setMode('join'); setValue(''); setError(null); }}>
        I have an invite code
      </Button>
    </FormScreen>
  ) : (
    <FormScreen title="Join a family" subtitle="Ask whoever invited you for their six-character code.">
      <Field label="Invite code" value={value} onChangeText={(t) => setValue(t.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" maxLength={6} />
      <ErrorText>{error}</ErrorText>
      <Button block disabled={busy || value.trim().length !== 6} onPress={submit}>
        Join family
      </Button>
      <Button variant="ghost" block onPress={() => { setMode('create'); setValue(''); setError(null); }}>
        Start a new family instead
      </Button>
    </FormScreen>
  );
}
