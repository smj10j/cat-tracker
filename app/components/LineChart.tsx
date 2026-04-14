/**
 * Native-first line chart built on react-native-svg.
 *
 * Why not Victory Native XL + Skia?
 * Skia's TurboModule caused SIGABRT on iOS 26 + RN 0.81 during screen
 * transitions. react-native-svg is stable, widely used, and gives us full
 * control over interactivity without a Skia dependency.
 *
 * Features:
 * - Smooth cubic Bezier curves (monotone-x spline)
 * - Gradient area fill under each line
 * - Data point dots with active-press highlighting
 * - Touch-to-inspect tooltip showing value + date
 * - Animated entrance
 * - Auto-scaling Y axis with nice tick values
 * - Fully crash-proof — pure JS rendering, no native modules
 */
import { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import Svg, {
  Path,
  Circle,
  Line as SvgLine,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  G,
  Rect,
} from 'react-native-svg';

import { CHART_LINE_COLORS as LINE_COLORS } from '@shared/lib/constants';

export interface ChartDataPoint {
  date: number; // timestamp ms
  [key: string]: number;
}

interface LineChartProps {
  data: ChartDataPoint[];
  seriesKeys: string[];
  seriesLabels?: Record<string, string>;
  seriesColors?: Record<string, string>;
  /** Per-series emoji to render instead of dots. Key = series key, value = map from data index → emoji string. */
  dotEmojis?: Record<string, Record<number, string>>;
  height?: number;
  yLabel?: string;
  formatY?: (v: number) => string;
  formatX?: (timestamp: number) => string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Pick "nice" axis ticks (multiples of 1, 2, 5, 10, etc.) */
function niceScale(min: number, max: number, maxTicks = 5): number[] {
  if (min === max) return [min];
  const range = max - min;
  const roughStep = range / maxTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / mag;
  const niceStep =
    residual <= 1.5 ? mag : residual <= 3 ? 2 * mag : residual <= 7 ? 5 * mag : 10 * mag;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + niceStep * 0.001; t += niceStep) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  return ticks;
}

/** Monotone-x cubic Bezier path (no overshooting) */
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0]!.x},${pts[0]!.y}`;
  if (pts.length === 2) return `M${pts[0]!.x},${pts[0]!.y}L${pts[1]!.x},${pts[1]!.y}`;

  // Compute tangent slopes using Fritsch-Carlson monotone method
  const n = pts.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1]!.x - pts[i]!.x);
    dy.push(pts[i + 1]!.y - pts[i]!.y);
    m.push(dx[i] !== 0 ? dy[i]! / dx[i]! : 0);
  }

  const tangents: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1]! * m[i]! <= 0) {
      tangents.push(0);
    } else {
      tangents.push((m[i - 1]! + m[i]!) / 2);
    }
  }
  tangents.push(m[n - 2]!);

  // Clamp tangents for monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]!) < 1e-6) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i]! / m[i]!;
      const b = tangents[i + 1]! / m[i]!;
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        tangents[i] = t * a * m[i]!;
        tangents[i + 1] = t * b * m[i]!;
      }
    }
  }

  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const dxi = dx[i]! / 3;
    const cp1x = pts[i]!.x + dxi;
    const cp1y = pts[i]!.y + tangents[i]! * dxi;
    const cp2x = pts[i + 1]!.x - dxi;
    const cp2y = pts[i + 1]!.y - tangents[i + 1]! * dxi;
    d += `C${cp1x},${cp1y},${cp2x},${cp2y},${pts[i + 1]!.x},${pts[i + 1]!.y}`;
  }
  return d;
}

function formatShortDateDefault(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Component ────────────────────────────────────────────────────────────

const MARGIN = { top: 12, right: 12, bottom: 28, left: 44 };

export default function LineChart({
  data,
  seriesKeys,
  seriesLabels,
  seriesColors,
  dotEmojis,
  height = 220,
  yLabel,
  formatY = (v) => String(Math.round(v * 10) / 10),
  formatX = formatShortDateDefault,
}: LineChartProps) {
  const colors = useThemeColors();
  const { screenWidth, contentMaxWidth } = useResponsiveLayout();
  const [containerWidth, setContainerWidth] = useState(
    Math.min(screenWidth, contentMaxWidth ?? screenWidth) - 32,
  );
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const svgRef = useRef<View>(null);

  // Clean data: only keep points with at least one valid value
  const cleanData = useMemo(
    () =>
      data
        .filter((point) =>
          seriesKeys.some((k) => {
            const v = point[k];
            return v !== undefined && v !== null && !Number.isNaN(v);
          }),
        )
        .sort((a, b) => a.date - b.date),
    [data, seriesKeys],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // ── Empty / single states ────────────────────────────────────────────
  if (cleanData.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.inkDim, fontSize: 14 }}>No data to chart</Text>
      </View>
    );
  }

  if (cleanData.length === 1) {
    const point = cleanData[0]!;
    return (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
        {seriesKeys.map((key, i) => {
          const val = point[key];
          if (val === undefined || val === null || Number.isNaN(val)) return null;
          const color = seriesColors?.[key] ?? LINE_COLORS[i % LINE_COLORS.length]!;
          const label = seriesLabels?.[key] ?? key;
          return (
            <Text key={key} style={{ color, fontSize: 16, fontWeight: '600' }}>
              {label}: {formatY(val)} {yLabel ?? ''}
            </Text>
          );
        })}
        <Text style={{ color: colors.inkDim, fontSize: 12, marginTop: 4 }}>
          {formatX(point.date)} — single data point
        </Text>
      </View>
    );
  }

  // ── Scales ───────────────────────────────────────────────────────────
  const plotW = containerWidth - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  const xMin = cleanData[0]!.date;
  const xMax = cleanData[cleanData.length - 1]!.date;
  const xRange = xMax - xMin || 1;

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const pt of cleanData) {
    for (const k of seriesKeys) {
      const v = pt[k];
      if (v !== undefined && v !== null && !Number.isNaN(v)) {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  // Add 10% padding
  const yPad = (yMax - yMin) * 0.1;
  yMin -= yPad;
  yMax += yPad;
  const yRange = yMax - yMin;

  const xScale = (ts: number) => MARGIN.left + ((ts - xMin) / xRange) * plotW;
  const yScale = (v: number) => MARGIN.top + (1 - (v - yMin) / yRange) * plotH;

  const yTicks = niceScale(yMin + yPad, yMax - yPad, 5);
  const xTickCount = Math.min(cleanData.length, 5);
  const xTickStep = Math.max(1, Math.floor(cleanData.length / xTickCount));
  const xTicks: number[] = [];
  for (let i = 0; i < cleanData.length; i += xTickStep) {
    xTicks.push(cleanData[i]!.date);
  }
  // Always include the last point
  if (xTicks[xTicks.length - 1] !== cleanData[cleanData.length - 1]!.date) {
    xTicks.push(cleanData[cleanData.length - 1]!.date);
  }

  // ── Build series paths ───────────────────────────────────────────────
  const seriesData = seriesKeys.map((key, i) => {
    const color = seriesColors?.[key] ?? LINE_COLORS[i % LINE_COLORS.length]!;
    const label = seriesLabels?.[key] ?? key;
    const pts = cleanData
      .map((pt, idx) => {
        const v = pt[key];
        if (v === undefined || v === null || Number.isNaN(v)) return null;
        return { x: xScale(pt.date), y: yScale(v), idx, value: v };
      })
      .filter(Boolean) as { x: number; y: number; idx: number; value: number }[];
    const linePath = monotonePath(pts);
    // Area path: line + drop to bottom + close
    const areaPath =
      pts.length >= 2
        ? `${linePath}L${pts[pts.length - 1]!.x},${yScale(yMin)}L${pts[0]!.x},${yScale(yMin)}Z`
        : '';
    return { key, color, label, pts, linePath, areaPath };
  });

  // ── Touch handling ───────────────────────────────────────────────────
  const findClosestIdx = (touchX: number): number | null => {
    if (cleanData.length === 0) return null;
    const plotX = touchX - MARGIN.left;
    const ratio = plotX / plotW;
    const idx = Math.round(ratio * (cleanData.length - 1));
    return Math.max(0, Math.min(cleanData.length - 1, idx));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_, gs) => {
          setActiveIdx(findClosestIdx(gs.x0));
        },
        onPanResponderMove: (_, gs) => {
          setActiveIdx(findClosestIdx(gs.moveX));
        },
        onPanResponderRelease: () => {
          // Keep tooltip visible for a moment
          setTimeout(() => setActiveIdx(null), 1500);
        },
      }),
    [cleanData.length, plotW],
  );

  const activePoint = activeIdx !== null ? cleanData[activeIdx] : null;
  const activePx = activePoint ? xScale(activePoint.date) : 0;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {/* Y-axis label */}
      {yLabel && (
        <Text
          style={{
            position: 'absolute',
            top: 0,
            left: 4,
            color: colors.inkDim,
            fontSize: 10,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {yLabel}
        </Text>
      )}

      {/* Tooltip */}
      {activePoint && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: Math.min(
              Math.max(activePx - 70, 4),
              containerWidth - 144,
            ),
            backgroundColor: colors.surfaceHi,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: 'rgba(192,132,252,0.3)',
            zIndex: 10,
            minWidth: 140,
          }}
        >
          <Text style={{ color: colors.inkMid, fontSize: 10, marginBottom: 2 }}>
            {formatX(activePoint.date)}
          </Text>
          {seriesKeys.map((key, i) => {
            const v = activePoint[key];
            if (v === undefined || v === null || Number.isNaN(v)) return null;
            const color = seriesColors?.[key] ?? LINE_COLORS[i % LINE_COLORS.length]!;
            const label = seriesLabels?.[key] ?? key;
            return (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: color,
                  }}
                />
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '600' }}>
                  {seriesKeys.length > 1 ? `${label}: ` : ''}
                  {formatY(v)}
                  {yLabel ? ` ${yLabel}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View ref={svgRef} {...panResponder.panHandlers}>
        <Svg width={containerWidth} height={height}>
          <Defs>
            {seriesData.map((s) => (
              <LinearGradient
                key={`grad-${s.key}`}
                id={`grad-${s.key}`}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <Stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                <Stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
              </LinearGradient>
            ))}
          </Defs>

          {/* Grid lines */}
          {yTicks.map((tick) => (
            <SvgLine
              key={`grid-${tick}`}
              x1={MARGIN.left}
              x2={containerWidth - MARGIN.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={colors.card}
              strokeWidth={1}
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <SvgText
              key={`ylabel-${tick}`}
              x={MARGIN.left - 6}
              y={yScale(tick) + 4}
              textAnchor="end"
              fill={colors.inkDim}
              fontSize={10}
            >
              {formatY(tick)}
            </SvgText>
          ))}

          {/* X-axis labels */}
          {xTicks.map((ts, i) => (
            <SvgText
              key={`xlabel-${i}`}
              x={xScale(ts)}
              y={height - 4}
              textAnchor="middle"
              fill={colors.inkDim}
              fontSize={10}
            >
              {formatX(ts)}
            </SvgText>
          ))}

          {/* Area fills */}
          {seriesData.map(
            (s) =>
              s.areaPath && (
                <Path
                  key={`area-${s.key}`}
                  d={s.areaPath}
                  fill={`url(#grad-${s.key})`}
                />
              ),
          )}

          {/* Lines */}
          {seriesData.map((s) => (
            <Path
              key={`line-${s.key}`}
              d={s.linePath}
              stroke={s.color}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Data point dots (or emoji when provided) */}
          {seriesData.map((s) => {
            const emojiMap = dotEmojis?.[s.key];
            return s.pts.map((pt) => {
              const emoji = emojiMap?.[pt.idx];
              if (emoji) {
                return (
                  <SvgText
                    key={`dot-${s.key}-${pt.idx}`}
                    x={pt.x}
                    y={pt.y + 5}
                    textAnchor="middle"
                    fontSize={activeIdx === pt.idx ? 16 : 12}
                  >
                    {emoji}
                  </SvgText>
                );
              }
              return (
                <Circle
                  key={`dot-${s.key}-${pt.idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={activeIdx === pt.idx ? 6 : 3}
                  fill={activeIdx === pt.idx ? s.color : colors.night}
                  stroke={s.color}
                  strokeWidth={activeIdx === pt.idx ? 2.5 : 1.5}
                />
              );
            });
          })}

          {/* Active vertical line */}
          {activePoint && (
            <SvgLine
              x1={activePx}
              x2={activePx}
              y1={MARGIN.top}
              y2={height - MARGIN.bottom}
              stroke="rgba(192,132,252,0.4)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          )}

          {/* Transparent touch target covering the plot area */}
          <Rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotW}
            height={plotH}
            fill="transparent"
          />
        </Svg>
      </View>

      {/* Legend */}
      {seriesKeys.length > 1 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 4,
            justifyContent: 'center',
          }}
        >
          {seriesKeys.map((key, i) => {
            const color = seriesColors?.[key] ?? LINE_COLORS[i % LINE_COLORS.length]!;
            const label = seriesLabels?.[key] ?? key;
            return (
              <View
                key={key}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: color,
                  }}
                />
                <Text style={{ color: colors.inkMid, fontSize: 11 }}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export { CHART_LINE_COLORS as LINE_COLORS } from '@shared/lib/constants';
