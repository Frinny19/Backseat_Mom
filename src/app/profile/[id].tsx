import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { BabyForm } from '@/components/BabyForm';
import { Sheet } from '@/components/Sheet';
import { useSession } from '@/state/session';
import { text, useTheme } from '@/theme';

/** Add a baby (`/profile/new`) or edit one's name, birth date and sex. */
export default function BabyProfile() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const baby = useSession((s) => s.babies.find((b) => b.id === id));
  const demo = useSession((s) => s.status === 'demo');
  const canEdit = useSession((s) => s.family?.role !== 'viewer');
  const addBaby = useSession((s) => s.addBaby);
  const updateBaby = useSession((s) => s.updateBaby);
  const isNew = id === 'new';

  if (demo || !canEdit || (!isNew && !baby)) {
    return (
      <Sheet title={isNew ? 'Add a baby' : (baby?.name ?? 'Baby')}>
        <Text style={[text('body'), { color: c.inkMuted }]}>
          {demo ? 'Babies can be added and edited once the app is connected to Supabase.' : 'Only people who can log can change baby details.'}
        </Text>
      </Sheet>
    );
  }

  return (
    <Sheet title={isNew ? 'Add a baby' : `Edit ${baby!.name}`} subtitle={isNew ? 'Twins and siblings each get their own log' : undefined}>
      <BabyForm
        baby={baby}
        submitLabel={isNew ? 'Add baby' : 'Save'}
        onSubmit={async (input) => {
          if (isNew) await addBaby(input);
          else await updateBaby(id, input);
          router.back();
        }}
      />
    </Sheet>
  );
}
