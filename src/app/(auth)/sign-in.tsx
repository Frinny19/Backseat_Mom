import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components';
import { ErrorText, Field, FormScreen } from '@/components/Screen';
import { useSession } from '@/state/session';
import { text, useTheme } from '@/theme';

export default function SignIn() {
  const { c } = useTheme();
  const sendCode = useSession((s) => s.sendCode);
  const verifyCode = useSession((s) => s.verifyCode);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!sent) {
    return (
      <FormScreen title="Welcome" subtitle="Log your baby's day together with everyone who helps.">
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <ErrorText>{error}</ErrorText>
        <Button block disabled={busy || !email.includes('@')} onPress={() => run(async () => { await sendCode(email); setSent(true); })}>
          Email me a code
        </Button>
      </FormScreen>
    );
  }

  return (
    <FormScreen title="Check your email" subtitle={`We sent a code to ${email}.`}>
      <Field
        label="Code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
        placeholder="12345678"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
      />
      <ErrorText>{error}</ErrorText>
      <Button block disabled={busy || !/^\d{6,10}$/.test(code)} onPress={() => run(() => verifyCode(email, code))}>
        Sign in
      </Button>
      <Button variant="ghost" block onPress={() => { setSent(false); setCode(''); }}>
        Use a different email
      </Button>
      <Text style={[text('caption'), { color: c.inkMuted }]}>Sign in with Apple and Google is coming next.</Text>
    </FormScreen>
  );
}
