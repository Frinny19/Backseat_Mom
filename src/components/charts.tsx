import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { font, radius, space, text, useTheme } from '@/theme';

/** Rounds up to a tidy axis maximum (1, 2, 2.5, 5 × 10^n). */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

type Bar = { label: string; value: number; display: string };

/**
 * One series of daily bars. Tap a bar to read its value in the header; the
 * header otherwise shows `summary` (usually the average).
 */
export function BarChart({
  title,
  summary,
  bars,
  color,
  height = 140,
}: {
  title: string;
  summary: string;
  bars: Bar[];
  color: string;
  height?: number;
}) {
  const { c, shadow } = useTheme();
  const [width, onLayout] = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const max = niceMax(Math.max(...bars.map((b) => b.value), 0));
  const axisH = 18;
  const plotH = height - axisH;
  const gap = 2;
  const slot = width / Math.max(bars.length, 1);
  const barW = Math.max(4, Math.min(28, slot * 0.6));
  const sel = selected !== null ? bars[selected] : null;
  const labelEvery = bars.length > 10 ? Math.ceil(bars.length / 7) : 1;

  return (
    <View
      style={[styles.card, shadow.soft, { backgroundColor: c.surface }]}
      accessible
      accessibilityLabel={`${title}. ${bars.map((b) => `${b.label}: ${b.display}`).join(', ')}`}
    >
      <View style={styles.head}>
        <Text style={[text('label'), { color: c.ink }]}>{title}</Text>
        <Text style={[styles.value, { color: c.ink }]}>{sel ? sel.display : summary}</Text>
        <Text style={[text('caption'), { color: c.inkMuted }]}>{sel ? sel.label : 'Daily average'}</Text>
      </View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {[0.5, 1].map((f) => (
              <Line key={f} x1={0} x2={width} y1={plotH - plotH * f} y2={plotH - plotH * f} stroke={c.border} strokeWidth={1} />
            ))}
            <Line x1={0} x2={width} y1={plotH} y2={plotH} stroke={c.inkMuted} strokeWidth={1} />
            <SvgText x={width - 2} y={10} fontSize={10} fill={c.inkMuted} textAnchor="end">
              {formatTick(max)}
            </SvgText>
            {bars.map((b, i) => {
              const h = b.value > 0 ? Math.max(3, (b.value / max) * (plotH - gap)) : 0;
              const x = i * slot + (slot - barW) / 2;
              const y = plotH - gap - h;
              const r = Math.min(4, barW / 2, h);
              const faded = selected !== null && selected !== i;
              return (
                <Path
                  key={i}
                  d={h ? topRounded(x, y, barW, h, r) : ''}
                  fill={color}
                  opacity={faded ? 0.35 : 1}
                />
              );
            })}
            {bars.map((b, i) =>
              i % labelEvery === 0 || i === bars.length - 1 ? (
                <SvgText key={`l${i}`} x={i * slot + slot / 2} y={height - 4} fontSize={10} fill={c.inkMuted} textAnchor="middle">
                  {b.label.split(' ')[0]}
                </SvgText>
              ) : null,
            )}
          </Svg>
        ) : null}
        {/* Hit targets: the whole column, not just the bar. */}
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.hits}>
            {bars.map((b, i) => (
              <Pressable
                key={i}
                style={styles.hit}
                accessibilityLabel={`${b.label}: ${b.display}`}
                onPressIn={() => setSelected(i)}
                onPressOut={() => setSelected(null)}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function formatTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

type Point = { x: number; y: number; label: string };
type Curve = { label: string; points: { x: number; y: number }[] };

/**
 * The baby's measurements over WHO reference curves. Curves are recessive;
 * the baby's line and dots carry the colour.
 */
export function GrowthChart({
  points,
  curves,
  color,
  xMax,
  unit,
  height = 220,
}: {
  points: Point[];
  curves: Curve[];
  color: string;
  /** Age in days at the right edge. */
  xMax: number;
  unit: string;
  height?: number;
}) {
  const { c } = useTheme();
  const [width, onLayout] = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const all = [...points.map((p) => p.y), ...curves.flatMap((cv) => cv.points.map((p) => p.y))];
  const yMin = Math.floor(Math.min(...all) * 0.95);
  const yMax = Math.ceil(Math.max(...all) * 1.02);
  const padR = 34;
  const padB = 18;
  const W = Math.max(0, width - padR);
  const H = height - padB;
  const sx = (x: number) => (x / xMax) * W;
  const sy = (y: number) => H - ((y - yMin) / (yMax - yMin || 1)) * H;
  const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join(' ');
  const months = Math.floor(xMax / 30.44);
  const step = months > 12 ? 3 : months > 6 ? 2 : 1;
  const sel = selected !== null ? points[selected] : null;

  return (
    <View>
      <Text style={[text('caption'), styles.selLine, { color: sel ? c.ink : c.inkMuted }]}>
        {sel ? sel.label : 'Tap a point to see the measurement'}
      </Text>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {curves.map((cv) => {
              const last = cv.points[cv.points.length - 1];
              return [
                <Path key={cv.label} d={line(cv.points)} stroke={c.inkMuted} strokeOpacity={0.45} strokeWidth={1.5} fill="none" strokeDasharray={cv.label === '50th' ? undefined : '4 4'} />,
                <SvgText key={`${cv.label}t`} x={sx(last.x) + 4} y={sy(last.y) + 3} fontSize={10} fill={c.inkMuted}>
                  {cv.label}
                </SvgText>,
              ];
            })}
            <Line x1={0} x2={W} y1={H} y2={H} stroke={c.inkMuted} strokeWidth={1} />
            {Array.from({ length: Math.floor(months / step) + 1 }, (_, i) => i * step).map((m) => (
              <SvgText key={m} x={sx(m * 30.44)} y={height - 4} fontSize={10} fill={c.inkMuted} textAnchor={m === 0 ? 'start' : 'middle'}>
                {m === 0 ? 'Birth' : `${m} mo`}
              </SvgText>
            ))}
            <SvgText x={W + 4} y={12} fontSize={10} fill={c.inkMuted}>
              {unit}
            </SvgText>
            {points.length > 1 ? <Path d={line(points)} stroke={color} strokeWidth={2} fill="none" /> : null}
            {points.map((p, i) => (
              <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={selected === i ? 6 : 4.5} fill={color} stroke={c.surface} strokeWidth={2} />
            ))}
            {points.map((p, i) => (
              <Rect
                key={`h${i}`}
                x={sx(p.x) - 16}
                y={sy(p.y) - 16}
                width={32}
                height={32}
                fill="transparent"
                onPressIn={() => setSelected(i)}
                onPressOut={() => setSelected(null)}
              />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space[4], borderRadius: radius.md, gap: space[3] },
  head: { gap: 2 },
  value: { ...font('display', 600, 26, 32), fontVariant: ['tabular-nums'] },
  hits: { flex: 1, flexDirection: 'row' },
  hit: { flex: 1 },
  selLine: { marginBottom: space[2] },
});
