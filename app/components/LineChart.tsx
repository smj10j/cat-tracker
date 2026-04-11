/**
 * Cross-platform line chart using Victory Native XL (Skia on native, SVG on web).
 * Used by Compare, WeightChart, and MeasurementChart screens.
 */
import { View, Text, Dimensions } from 'react-native';
import { CartesianChart, Line, useChartPressState } from 'victory-native';
import { Circle, useFont } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

const LINE_COLORS = ['#c084fc', '#4ade80', '#f97316', '#fbbf24', '#fb923c', '#f87171'];

export interface ChartDataPoint {
  date: number; // timestamp ms
  [key: string]: number; // one key per series (e.g., cat IDs or "value")
}

interface LineChartProps {
  data: ChartDataPoint[];
  seriesKeys: string[];
  seriesLabels?: Record<string, string>;
  seriesColors?: Record<string, string>;
  height?: number;
  yLabel?: string;
  formatY?: (v: number) => string;
  formatX?: (timestamp: number) => string;
}

function ToolTipDot({ x, y, color }: { x: SharedValue<number>; y: SharedValue<number>; color: string }) {
  return <Circle cx={x} cy={y} r={5} color={color} />;
}

export default function LineChart({
  data,
  seriesKeys,
  seriesLabels,
  seriesColors,
  height = 220,
  yLabel,
  formatY = (v) => String(Math.round(v * 10) / 10),
  formatX = (ts) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },
}: LineChartProps) {
  const { state, isActive } = useChartPressState({
    x: 0,
    y: Object.fromEntries(seriesKeys.map(k => [k, 0])),
  });

  const width = Dimensions.get('window').width - 32; // 16px padding each side

  if (data.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6b5f85', fontSize: 14 }}>No data to chart</Text>
      </View>
    );
  }

  if (data.length === 1) {
    // Single point — show value card instead of chart
    const point = data[0]!;
    return (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
        {seriesKeys.map((key, i) => {
          const val = point[key];
          if (val === undefined || val === null) return null;
          const color = seriesColors?.[key] ?? LINE_COLORS[i % LINE_COLORS.length]!;
          const label = seriesLabels?.[key] ?? key;
          return (
            <Text key={key} style={{ color, fontSize: 16, fontWeight: '600' }}>
              {label}: {formatY(val)} {yLabel ?? ''}
            </Text>
          );
        })}
        <Text style={{ color: '#6b5f85', fontSize: 12, marginTop: 4 }}>
          {formatX(point.date)} — single data point
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height, width }}>
      {yLabel && (
        <Text style={{ color: '#6b5f85', fontSize: 11, marginBottom: 2, marginLeft: 4 }}>
          {yLabel}
        </Text>
      )}
      <CartesianChart
        data={data}
        xKey="date"
        yKeys={seriesKeys as [string, ...string[]]}
        domainPadding={{ top: 20, bottom: 20, left: 10, right: 10 }}
        axisOptions={{
          font: null,
          tickCount: { x: 4, y: 5 },
          formatXLabel: (val) => formatX(val as number),
          formatYLabel: (val) => {
            const formatted = formatY(val as number);
            return yLabel ? `${formatted}` : formatted;
          },
          labelColor: '#a899c0',
          lineColor: 'rgba(255,255,255,0.1)',
        }}
        chartPressState={state}
      >
        {({ points }) =>
          seriesKeys.map((key, i) => {
            const color = seriesColors?.[key] ?? LINE_COLORS[i % LINE_COLORS.length]!;
            const seriesPoints = points[key];
            if (!seriesPoints) return null;
            return (
              <Line
                key={key}
                points={seriesPoints}
                color={color}
                strokeWidth={2.5}
                curveType="natural"
                animate={{ type: 'timing', duration: 300 }}
              />
            );
          })
        }
      </CartesianChart>

      {/* Legend */}
      {seriesKeys.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, justifyContent: 'center' }}>
          {seriesKeys.map((key, i) => {
            const color = seriesColors?.[key] ?? LINE_COLORS[i % LINE_COLORS.length]!;
            const label = seriesLabels?.[key] ?? key;
            return (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                <Text style={{ color: '#a899c0', fontSize: 11 }}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export { LINE_COLORS };
