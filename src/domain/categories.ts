import type { IconName } from '@/components/Icon';

/** The six things Backseat Mom logs. Matches the `entries.category` check in Postgres. */
export const CATEGORIES = ['feed', 'pump', 'sleep', 'diaper', 'med', 'milestone'] as const;
export type Category = (typeof CATEGORIES)[number];

export type CategoryInfo = {
  id: Category;
  label: string;
  icon: IconName;
  /** Timed categories can have an entry with no end time, which shows as running on the ribbon. */
  timed: boolean;
};

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  feed: { id: 'feed', label: 'Feed', icon: 'bottle', timed: true },
  pump: { id: 'pump', label: 'Pump', icon: 'pump', timed: true },
  sleep: { id: 'sleep', label: 'Sleep', icon: 'moon', timed: true },
  diaper: { id: 'diaper', label: 'Diaper', icon: 'diaper', timed: false },
  med: { id: 'med', label: 'Meds', icon: 'pill', timed: false },
  milestone: { id: 'milestone', label: 'Milestone', icon: 'star', timed: false },
};

/** Database spelling of each category (`med` is stored as `medication`). */
export const DB_CATEGORY: Record<Category, string> = {
  feed: 'feed',
  pump: 'pump',
  sleep: 'sleep',
  diaper: 'diaper',
  med: 'medication',
  milestone: 'milestone',
};

export function categoryFromDb(value: string): Category {
  const found = CATEGORIES.find((c) => DB_CATEGORY[c] === value);
  if (!found) throw new Error(`Unknown category: ${value}`);
  return found;
}
