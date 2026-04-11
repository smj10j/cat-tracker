/**
 * Cross-platform line chart using Victory Native XL (Skia on native, SVG on web).
 * Used by Compare, WeightChart, and MeasurementChart screens.
 *
 * NOTE: useChartPressState and Skia tooltip dots were removed because they caused
 * native crashes (SIGABRT in ObjCTurboModule::performVoidMethodInvocation) on
 * iOS 26 with react-native-screens ~4.16 + Skia 2.2.12. The chart renders lines
 * and axis labels only — no interactive tooltip on press.
 */
import { View, Text, Dimensions, Platform } from 'react-native';
import { CartesianChart, Line } from 'victory-native';

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
  const width = Dimensions.get('window').width - 32; // 16px padding each side

  // Filter out data points with NaN/undefined/null values for each series
  const cleanData = data.filter((point) =>
    seriesKeys.some((key) => {
      const val = point[key];
      return val !== undefined && val !== null && !Number.isNaN(val);
    }),
  );

  if (cleanData.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6b5f85', fontSize: 14 }}>No data to chart</Text>
      </View>
    );
  }

  if (cleanData.length === 1) {
    // Single point — show value card instead of chart
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
        <Text style={{ color: '#6b5f85', fontSize: 12, marginTop: 4 }}>
          {formatX(point.date)} — single data point
        </Text>
      </View>
    );
  }

  // Replace NaN with 0 for Victory Native (it can't handle NaN in series data)
  const safeData = cleanData.map((point) => {
    const safe: ChartDataPoint = { date: point.date };
    for (const key of seriesKeys) {
      const val = point[key];
      safe[key] = val !== undefined && val !== null && !Number.isNaN(val) ? val : 0;
    }
    return safe;
  });

  return (
    <View style={{ height, width }}>
      {yLabel && (
        <Text style={{ color: '#6b5f85', fontSize: 11, marginBottom: 2, marginLeft: 4 }}>
          {yLabel}
        </Text>
      )}
      <CartesianChart
        data={safeData}
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
