import { HCFA_BOYS, HCFA_GIRLS, LHFA_BOYS, LHFA_GIRLS, WFA_BOYS, WFA_GIRLS, type LmsRow } from './growthData';

export type Measure = 'weight' | 'length' | 'head';
export type Sex = 'female' | 'male';

const TABLES: Record<Measure, Record<Sex, LmsRow[]>> = {
  weight: { male: WFA_BOYS, female: WFA_GIRLS },
  length: { male: LHFA_BOYS, female: LHFA_GIRLS },
  head: { male: HCFA_BOYS, female: HCFA_GIRLS },
};

const DAY = 24 * 3600_000;
export const MAX_DAYS = 728;

/** WHO LMS parameters at an age in days, interpolated between weekly rows. */
function lmsAt(measure: Measure, sex: Sex, days: number): LmsRow | null {
  const rows = TABLES[measure][sex];
  if (days < 0 || days > (rows.length - 1) * 7) return null;
  const i = Math.floor(days / 7);
  const t = days / 7 - i;
  const a = rows[i];
  const b = rows[Math.min(i + 1, rows.length - 1)];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** The measurement at a given z-score (0 is the median). */
export function valueAtZ(measure: Measure, sex: Sex, days: number, z: number): number | null {
  const lms = lmsAt(measure, sex, days);
  if (!lms) return null;
  const [L, M, S] = lms;
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

export function zScore(measure: Measure, sex: Sex, days: number, value: number): number | null {
  const lms = lmsAt(measure, sex, days);
  if (!lms || !(value > 0)) return null;
  const [L, M, S] = lms;
  return L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
}

/** Standard normal CDF (Abramowitz and Stegun 7.1.26, accurate to about 1e-7). */
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Percentile (0-100) for a measurement, or null outside 0-2 years. */
export function percentile(measure: Measure, sex: Sex, birth: Date, at: Date, value: number): number | null {
  const z = zScore(measure, sex, (at.getTime() - birth.getTime()) / DAY, value);
  return z === null ? null : phi(z) * 100;
}

/** "50th", "3rd", "below the 1st". */
export function formatPercentile(p: number): string {
  if (p < 1) return 'below the 1st';
  if (p > 99) return 'above the 99th';
  const n = Math.round(p);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** The WHO curves drawn behind a baby's points. */
export const CURVES = [
  { z: -1.881, label: '3rd' },
  { z: 0, label: '50th' },
  { z: 1.881, label: '97th' },
] as const;

export const UNITS: Record<Measure, string> = { weight: 'kg', length: 'cm', head: 'cm' };
export const MEASURE_LABEL: Record<Measure, string> = { weight: 'Weight', length: 'Length', head: 'Head' };
