import { useColorScheme } from 'react-native';
import type { TextStyle } from 'react-native';

import { useSettings } from '@/state/settings';
import type { Category } from '@/domain/categories';

import { colors, radius, shadows, space, typeScale } from './tokens';

export { colors, radius, shadows, space, typeScale };

export type SchemeName = keyof typeof colors;
export type Palette = { [K in keyof (typeof colors)['light']]: string };
export type TypeStyleName = keyof typeof typeScale;

/** Font family names registered in src/app/_layout.tsx. React Native needs one family per weight. */
export const fontFiles = {
  'Fredoka-Medium': require('@expo-google-fonts/fredoka/500Medium/Fredoka_500Medium.ttf'),
  'Fredoka-SemiBold': require('@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf'),
  'Nunito-Regular': require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
  'Nunito-SemiBold': require('@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf'),
  'Nunito-Bold': require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
  'Nunito-ExtraBold': require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
} as const;

type Family = 'display' | 'sans';

export function fontFamily(family: Family, weight: number): string {
  if (family === 'display') return weight >= 600 ? 'Fredoka-SemiBold' : 'Fredoka-Medium';
  if (weight >= 800) return 'Nunito-ExtraBold';
  if (weight >= 700) return 'Nunito-Bold';
  if (weight >= 600) return 'Nunito-SemiBold';
  return 'Nunito-Regular';
}

/** A text style from the design system's type scale, e.g. `text('headline')`. */
export function text(name: TypeStyleName): TextStyle {
  const s = typeScale[name];
  return { fontFamily: fontFamily(s.family, s.fontWeight), fontSize: s.fontSize, lineHeight: s.lineHeight };
}

/** Same as `text`, for one-off sizes the components use (chip time, tab label). */
export function font(family: Family, weight: number, fontSize: number, lineHeight: number): TextStyle {
  return { fontFamily: fontFamily(family, weight), fontSize, lineHeight };
}

export type Theme = {
  scheme: SchemeName;
  c: Palette;
  shadow: (typeof shadows)[SchemeName];
};

export function themeFor(scheme: SchemeName): Theme {
  return { scheme, c: colors[scheme], shadow: shadows[scheme] };
}

/** The active theme: Daytime, Night feed, or follow the system (Settings). */
export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useSettings((s) => s.themePreference);
  const scheme: SchemeName = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return themeFor(scheme);
}

/** The tint (fills) and ink (text and icons on the tint) for a category. */
export function activityColors(c: Palette, category: Category): { tint: string; ink: string } {
  return { tint: c[`${category}Tint`], ink: c[`${category}Ink`] };
}
