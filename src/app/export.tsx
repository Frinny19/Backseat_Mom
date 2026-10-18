import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components';
import { Label, Segmented } from '@/components/form';
import { ErrorText } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useAppData } from '@/data/DataProvider';
import { doctorSummaryHtml, entriesCsv } from '@/domain/export';
import { useBabyData } from '@/hooks/useBabyData';
import { sharePdf, shareText } from '@/lib/share';
import { formatAge } from '@/lib/time';
import { text, useTheme } from '@/theme';

const RANGES = [
  { id: '7', label: '7 days' },
  { id: '14', label: '14 days' },
  { id: '30', label: '30 days' },
] as const;

const stamp = (d: Date) => d.toISOString().slice(0, 10);

/** A doctor's summary as a PDF, or everything as a spreadsheet. */
export default function Export() {
  const { c } = useTheme();
  const data = useAppData();
  const { baby, medicationNames, names } = useBabyData();
  const [days, setDays] = useState<(typeof RANGES)[number]['id']>('14');
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

  const slug = (baby?.name ?? 'baby').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const pdf = () =>
    run(async () => {
      if (!data || !baby) return;
      const now = new Date();
      const html = doctorSummaryHtml({
        baby,
        entries: await data.entries(baby.id, Number(days) + 2),
        milestones: await data.milestones(baby.id),
        medNames: medicationNames,
        ageText: baby.birthDate ? formatAge(baby.birthDate, now) : null,
        days: Number(days),
        now,
      });
      await sharePdf(`${slug}-summary-${stamp(now)}.pdf`, html);
    });

  const csv = () =>
    run(async () => {
      if (!data || !baby) return;
      const all = await data.entries(baby.id, 3650);
      await shareText(`${slug}-log-${stamp(new Date())}.csv`, entriesCsv(all, names, medicationNames), 'text/csv', 'public.comma-separated-values-text');
    });

  return (
    <Sheet title="Export" subtitle={baby ? `For ${baby.name}` : undefined}>
      <Text style={[text('title'), { color: c.ink }]}>Doctor summary</Text>
      <Text style={[text('body'), { color: c.inkMuted }]}>
        A one-page PDF with daily averages for feeds, sleep and diapers, plus growth with WHO percentiles, recent medication doses and milestones.
      </Text>
      <Label>Covering the last</Label>
      <Segmented options={[...RANGES]} value={days} onChange={setDays} />
      <Button block onPress={pdf} disabled={busy || !baby}>
        Share PDF
      </Button>

      <Text style={[text('title'), { color: c.ink }]}>Everything as a spreadsheet</Text>
      <Text style={[text('body'), { color: c.inkMuted }]}>
        Every entry ever logged for this baby as a CSV file, which opens in Excel, Numbers or Google Sheets.
      </Text>
      <Button block variant="soft" onPress={csv} disabled={busy || !baby}>
        Share CSV
      </Button>
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}
