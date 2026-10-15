import { z } from 'zod';

import type { Category } from './categories';

// One definition of what each category's `details` holds. The app validates
// with these before writing; Postgres enforces the category/kind pairs.

const side = z.enum(['left', 'right']);
const volumeUnit = z.enum(['ml', 'oz']);

export const breastSegment = z.object({
  side,
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).optional(),
});

export const feedDetails = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('breast'), segments: z.array(breastSegment).default([]), lastSide: side.optional() }),
  z.object({
    kind: z.literal('bottle'),
    amount: z.number().positive().optional(),
    unit: volumeUnit.default('ml'),
    milk: z.enum(['breast_milk', 'formula']).optional(),
    amountLeft: z.number().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal('solids'),
    foods: z.array(z.string().min(1)).default([]),
    amount: z.string().optional(),
    reaction: z.string().optional(),
  }),
]);

export const pumpDetails = z.object({
  kind: z.enum(['single', 'double']),
  left: z.number().nonnegative().optional(),
  right: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  unit: volumeUnit.default('ml'),
  use: z.enum(['stored', 'used']).optional(),
  storage: z.enum(['fridge', 'freezer']).optional(),
});

export const sleepDetails = z.object({
  kind: z.enum(['nap', 'night']),
  place: z.enum(['crib', 'bassinet', 'stroller', 'arms', 'car', 'bed', 'other']).optional(),
  fellAsleep: z.enum(['fed', 'rocked', 'on_own', 'held', 'other']).optional(),
  wakings: z.number().int().nonnegative().optional(),
});

export const diaperDetails = z.object({
  kind: z.enum(['wet', 'dirty', 'mixed', 'dry']),
  colour: z.enum(['yellow', 'green', 'brown', 'black', 'red', 'white', 'other']).optional(),
  consistency: z.enum(['runny', 'seedy', 'soft', 'formed', 'hard']).optional(),
  rash: z.boolean().optional(),
});

export const medDetails = z.object({
  kind: z.literal('dose'),
  dose: z.number().positive(),
  unit: z.string().min(1),
  route: z.enum(['oral', 'drops', 'topical', 'rectal', 'other']).optional(),
  reason: z.string().optional(),
  temperatureC: z.number().min(30).max(45).optional(),
});

export const milestoneDetails = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('developmental'), title: z.string().min(1), catalogId: z.string().optional() }),
  z.object({ kind: z.literal('first'), title: z.string().min(1) }),
  z.object({
    kind: z.literal('growth'),
    weightKg: z.number().positive().optional(),
    lengthCm: z.number().positive().optional(),
    headCm: z.number().positive().optional(),
  }),
]);

export const detailsSchema = {
  feed: feedDetails,
  pump: pumpDetails,
  sleep: sleepDetails,
  diaper: diaperDetails,
  med: medDetails,
  milestone: milestoneDetails,
} satisfies Record<Category, z.ZodType>;

export type DetailsFor<C extends Category> = z.infer<(typeof detailsSchema)[C]>;

/** An entry as the app sees it. `endedAt` null on a timed entry means it is running. */
export type Entry<C extends Category = Category> = {
  id: string;
  babyId: string;
  category: C;
  startedAt: Date;
  endedAt: Date | null;
  details: DetailsFor<C>;
  note?: string | null;
  medicationId?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: Date | null;
};

export function parseDetails<C extends Category>(category: C, details: unknown): DetailsFor<C> {
  return detailsSchema[category].parse(details) as DetailsFor<C>;
}
