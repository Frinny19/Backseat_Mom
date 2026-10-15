import { router } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import type { Medication } from '@/data/rows';
import { CATEGORY_INFO } from '@/domain/categories';
import type { Draft } from '@/domain/drafts';
import { activityColors, space, text, useTheme } from '@/theme';

import { Chips, Label, NoteField, Segmented, Stepper, TextField, TimeField } from './form';

type Props = {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  now: Date;
  medications: Medication[];
  /** Show when it happened and, for timed categories, how long. Off while a timer runs. */
  showTimes?: boolean;
};

const opts = <const T extends string>(pairs: readonly (readonly [T, string])[]) => pairs.map(([id, label]) => ({ id, label }));

const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

/** The fields for one category's log sheet. Also used when editing an entry. */
export function EntryForm({ draft: d, onChange, now, medications, showTimes = true }: Props) {
  const { c } = useTheme();
  const { tint, ink } = activityColors(c, d.category);
  const timed = CATEGORY_INFO[d.category].timed;

  return (
    <View style={styles.form}>
      {d.category === 'feed' ? (
        <>
          <Segmented
            options={opts([['breast', 'Breast'], ['bottle', 'Bottle'], ['solids', 'Solids']])}
            value={d.feedKind}
            onChange={(feedKind) => onChange({ feedKind })}
            tint={tint}
            ink={ink}
          />
          {d.feedKind === 'breast' ? (
            <View>
              <Label>{showTimes ? 'Last side' : 'Start on'}</Label>
              <Segmented
                options={opts([['left', 'Left'], ['right', 'Right']])}
                value={d.side}
                onChange={(side) => onChange({ side })}
                tint={tint}
                ink={ink}
              />
            </View>
          ) : null}
          {d.feedKind === 'bottle' ? (
            <>
              <View>
                <Label>Amount</Label>
                <Stepper
                  label="Amount"
                  value={d.amount}
                  onChange={(amount) => onChange({ amount })}
                  step={d.unit === 'ml' ? 10 : 0.5}
                  unit={d.unit}
                />
              </View>
              <Segmented options={opts([['ml', 'ml'], ['oz', 'oz']])} value={d.unit} onChange={(unit) => onChange({ unit })} />
              <Chips
                options={opts([['breast_milk', 'Breast milk'], ['formula', 'Formula']])}
                value={d.milk}
                onChange={(milk) => onChange({ milk })}
                tint={tint}
                ink={ink}
              />
            </>
          ) : null}
          {d.feedKind === 'solids' ? (
            <TextField label="Foods" placeholder="Banana, oatmeal" value={d.foods} onChangeText={(foods) => onChange({ foods })} />
          ) : null}
        </>
      ) : null}

      {d.category === 'pump' ? (
        <>
          <Segmented
            options={opts([['double', 'Both sides'], ['single', 'One side']])}
            value={d.pumpKind}
            onChange={(pumpKind) => onChange({ pumpKind })}
            tint={tint}
            ink={ink}
          />
          <View>
            <Label>{d.pumpKind === 'double' ? 'Left' : 'Amount'}</Label>
            <Stepper label={d.pumpKind === 'double' ? 'Left' : 'Amount'} value={d.left} onChange={(left) => onChange({ left })} step={d.unit === 'ml' ? 10 : 0.5} unit={d.unit} />
          </View>
          {d.pumpKind === 'double' ? (
            <View>
              <Label>Right</Label>
              <Stepper label="Right" value={d.right} onChange={(right) => onChange({ right })} step={d.unit === 'ml' ? 10 : 0.5} unit={d.unit} />
            </View>
          ) : null}
          <Segmented options={opts([['ml', 'ml'], ['oz', 'oz']])} value={d.unit} onChange={(unit) => onChange({ unit })} />
          <Chips options={opts([['stored', 'Stored'], ['used', 'Fed right away']])} value={d.use} onChange={(use) => onChange({ use })} tint={tint} ink={ink} />
          {d.use === 'stored' ? (
            <Chips options={opts([['fridge', 'Fridge'], ['freezer', 'Freezer']])} value={d.storage} onChange={(storage) => onChange({ storage })} tint={tint} ink={ink} />
          ) : null}
        </>
      ) : null}

      {d.category === 'sleep' ? (
        <>
          <Segmented options={opts([['nap', 'Nap'], ['night', 'Night']])} value={d.sleepKind} onChange={(sleepKind) => onChange({ sleepKind })} tint={tint} ink={ink} />
          <View>
            <Label>Where</Label>
            <Chips
              options={opts([['crib', 'Crib'], ['bassinet', 'Bassinet'], ['arms', 'Arms'], ['stroller', 'Stroller'], ['car', 'Car'], ['bed', 'Bed']])}
              value={d.place}
              onChange={(place) => onChange({ place })}
              tint={tint}
              ink={ink}
            />
          </View>
        </>
      ) : null}

      {d.category === 'diaper' ? (
        <>
          <Segmented
            options={opts([['wet', 'Wet'], ['dirty', 'Dirty'], ['mixed', 'Both'], ['dry', 'Dry']])}
            value={d.diaperKind}
            onChange={(diaperKind) => onChange({ diaperKind })}
            tint={tint}
            ink={ink}
          />
          {d.diaperKind === 'dirty' || d.diaperKind === 'mixed' ? (
            <>
              <View>
                <Label>Colour</Label>
                <Chips
                  options={opts([['yellow', 'Yellow'], ['green', 'Green'], ['brown', 'Brown'], ['black', 'Black'], ['red', 'Red'], ['white', 'White']])}
                  value={d.colour}
                  onChange={(colour) => onChange({ colour })}
                  tint={tint}
                  ink={ink}
                />
              </View>
              <View>
                <Label>Texture</Label>
                <Chips
                  options={opts([['runny', 'Runny'], ['seedy', 'Seedy'], ['soft', 'Soft'], ['formed', 'Formed'], ['hard', 'Hard']])}
                  value={d.consistency}
                  onChange={(consistency) => onChange({ consistency })}
                  tint={tint}
                  ink={ink}
                />
              </View>
            </>
          ) : null}
          <View style={styles.switchRow}>
            <Text style={[text('label'), { color: c.ink }]}>Diaper rash</Text>
            <Switch value={d.rash} onValueChange={(rash) => onChange({ rash })} accessibilityLabel="Diaper rash" />
          </View>
        </>
      ) : null}

      {d.category === 'med' ? (
        <>
          <View>
            <Label>Medication</Label>
            <Chips
              options={[
                ...medications.filter((m) => m.active || m.id === d.medicationId).map((m) => ({ id: m.id, label: m.name })),
                { id: '__add', label: '+ Add' },
              ]}
              value={d.medicationId}
              onChange={(id) => {
                if (id === '__add') return router.push('/medications');
                const med = medications.find((m) => m.id === id);
                onChange({
                  medicationId: id,
                  ...(med?.defaultDose ? { dose: med.defaultDose } : {}),
                  ...(med?.unit ? { doseUnit: med.unit } : {}),
                });
              }}
              tint={tint}
              ink={ink}
            />
          </View>
          <View>
            <Label>Dose</Label>
            <Stepper label="Dose" value={d.dose} onChange={(dose) => onChange({ dose })} step={0.5} unit={d.doseUnit} />
          </View>
          <TextField label="Reason" placeholder="Fever, teething" value={d.reason} onChangeText={(reason) => onChange({ reason })} />
          {d.temperatureC === null ? (
            <Chips options={[{ id: 'temp', label: '+ Temperature' }]} value={null} onChange={() => onChange({ temperatureC: 37 })} tint={tint} ink={ink} />
          ) : (
            <View>
              <Label>Temperature</Label>
              <Stepper label="Temperature" value={d.temperatureC} onChange={(temperatureC) => onChange({ temperatureC })} step={0.1} min={30} unit="°C" />
            </View>
          )}
        </>
      ) : null}

      {d.category === 'milestone' ? (
        <>
          <Segmented
            options={opts([['first', 'A first'], ['developmental', 'Skill'], ['growth', 'Growth']])}
            value={d.milestoneKind}
            onChange={(milestoneKind) => onChange({ milestoneKind })}
            tint={tint}
            ink={ink}
          />
          {d.milestoneKind === 'growth' ? (
            <>
              <View>
                <Label>Weight (kg)</Label>
                <Stepper label="Weight" value={d.weightKg ?? 0} onChange={(weightKg) => onChange({ weightKg })} step={0.05} unit="kg" />
              </View>
              <View>
                <Label>Length (cm)</Label>
                <Stepper label="Length" value={d.lengthCm ?? 0} onChange={(lengthCm) => onChange({ lengthCm })} step={0.5} unit="cm" />
              </View>
              <View>
                <Label>Head (cm)</Label>
                <Stepper label="Head" value={d.headCm ?? 0} onChange={(headCm) => onChange({ headCm })} step={0.5} unit="cm" />
              </View>
            </>
          ) : (
            <TextField
              label="What happened"
              placeholder={d.milestoneKind === 'first' ? 'First laugh' : 'Rolls over'}
              value={d.title}
              onChangeText={(title) => onChange({ title })}
            />
          )}
        </>
      ) : null}

      {showTimes ? (
        <>
          <TimeField label={timed ? 'Started' : 'When'} value={d.startedAt} onChange={(startedAt) => onChange({ startedAt })} now={now} />
          {timed ? (
            <View>
              <Label>How long</Label>
              <Chips
                options={DURATIONS.map((m) => ({ id: String(m), label: m < 60 ? `${m} min` : `${m / 60} h` }))}
                value={String(d.durationMin)}
                onChange={(v) => v && onChange({ durationMin: Number(v) })}
                tint={tint}
                ink={ink}
              />
              {!DURATIONS.includes(d.durationMin) ? (
                <Text style={[text('caption'), styles.hint, { color: c.inkMuted }]}>{d.durationMin} min</Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <NoteField value={d.note} onChangeText={(note) => onChange({ note })} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[4] },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { marginTop: space[1] },
});
