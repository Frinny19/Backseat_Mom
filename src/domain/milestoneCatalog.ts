/**
 * Common milestones by the age most babies reach them, adapted from the
 * CDC's "Learn the Signs. Act Early." checklists. Every baby develops at
 * their own pace; this is a list to tick off, not a test.
 */
export type CatalogItem = { id: string; months: number; title: string };

export const MILESTONE_CATALOG: CatalogItem[] = [
  { id: 'm2-smile', months: 2, title: 'Smiles when you talk or smile' },
  { id: 'm2-calms', months: 2, title: 'Calms down when spoken to or picked up' },
  { id: 'm2-head-up', months: 2, title: 'Holds head up during tummy time' },
  { id: 'm2-coos', months: 2, title: 'Makes sounds other than crying' },
  { id: 'm4-laugh', months: 4, title: 'Laughs' },
  { id: 'm4-hands-mouth', months: 4, title: 'Brings hands to mouth' },
  { id: 'm4-head-steady', months: 4, title: 'Holds head steady when held' },
  { id: 'm4-push-up', months: 4, title: 'Pushes up onto elbows during tummy time' },
  { id: 'm6-roll', months: 6, title: 'Rolls from tummy to back' },
  { id: 'm6-reach', months: 6, title: 'Reaches for a toy' },
  { id: 'm6-raspberries', months: 6, title: 'Blows raspberries' },
  { id: 'm6-squeal', months: 6, title: 'Squeals' },
  { id: 'm9-sit', months: 9, title: 'Sits without support' },
  { id: 'm9-name', months: 9, title: 'Looks when you call their name' },
  { id: 'm9-babble', months: 9, title: 'Babbles "mamama" or "bababa"' },
  { id: 'm9-peekaboo', months: 9, title: 'Smiles or laughs at peekaboo' },
  { id: 'm12-pull-stand', months: 12, title: 'Pulls up to stand' },
  { id: 'm12-cruise', months: 12, title: 'Walks holding onto furniture' },
  { id: 'm12-wave', months: 12, title: 'Waves bye-bye' },
  { id: 'm12-mama', months: 12, title: 'Says "mama" or "dada" for a parent' },
  { id: 'm12-pincer', months: 12, title: 'Picks things up between thumb and finger' },
  { id: 'm15-steps', months: 15, title: 'Takes a few steps alone' },
  { id: 'm15-word', months: 15, title: 'Says a word besides "mama" or "dada"' },
  { id: 'm15-point', months: 15, title: 'Points to ask for something' },
  { id: 'm18-walk', months: 18, title: 'Walks without holding on' },
  { id: 'm18-spoon', months: 18, title: 'Tries to use a spoon' },
  { id: 'm18-words', months: 18, title: 'Tries to say three or more words' },
  { id: 'm24-kick', months: 24, title: 'Kicks a ball' },
  { id: 'm24-two-words', months: 24, title: 'Says two words together, like "more milk"' },
  { id: 'm24-run', months: 24, title: 'Runs' },
];

export const CATALOG_AGES = [...new Set(MILESTONE_CATALOG.map((m) => m.months))];
