import Svg, { Path } from 'react-native-svg';

// Path data from the Backseat Mom design system's components bundle.
const PATHS = {
  bottle: ['M10 2h4v3h-4z', 'M9 5h6l1 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z', 'M8 12h3', 'M8 16h3'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  diaper: ['M3 6h18v4c0 5-4 8-9 8s-9-3-9-8z', 'M7.5 10a4.5 4.5 0 0 0 9 0'],
  ruler: ['M3 17L17 3l4 4L7 21z', 'M7 13l2 2', 'M10 10l2 2', 'M13 7l2 2'],
  ball: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M3.5 9.5c5 2 12 2 17 0', 'M12 3c-3 5-3 13 0 18'],
  pump: ['M3 5h10l-3 5H6z', 'M8 10v2', 'M5.5 12h5v8a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1z', 'M13 7h3a4 4 0 0 1 4 4v3'],
  pill: ['M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z', 'M7 7l7 7'],
  star: ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z'],
  sliders: ['M4 7h9', 'M17 7h3', 'M15 5v4', 'M4 17h3', 'M11 17h9', 'M9 15v4'],
  home: ['M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z'],
  chart: ['M5 20V11', 'M12 20V4', 'M19 20v-7'],
  plus: ['M12 5v14', 'M5 12h14'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
} as const;

export type IconName = keyof typeof PATHS;

export type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  /** Pass when the icon is the only content of a control; otherwise it is decorative. */
  label?: string;
};

/** 24px rounded line icon with 2px strokes. */
export function Icon({ name, size = 24, color, label }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      {PATHS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
