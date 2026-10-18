import { BabyForm } from '@/components/BabyForm';
import { FormScreen } from '@/components/Screen';
import { useSession } from '@/state/session';

export default function BabyStep() {
  const addBaby = useSession((s) => s.addBaby);
  return (
    <FormScreen title="Add your baby" subtitle="You can add more babies later.">
      <BabyForm submitLabel="Add baby" onSubmit={addBaby} />
    </FormScreen>
  );
}
