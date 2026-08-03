'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltip, tooltipCount } from '@/components/charts/chart-tooltip';
import { formatMoneyCompact, toPlotValue } from '@/lib/money';
import type { TrendPoint } from '@/lib/types';

/**
 * Money in and money out over time.
 *
 * Both series are money on the same scale, so they share one axis. A second
 * y-axis would let the two lines cross wherever the scales happened to put
 * them and imply a relationship that is not in the data.
 *
 * The API gap-fills empty buckets with zeros, so a quiet week draws a flat
 * line at zero rather than a straight segment joining the two active days
 * around it — which would suggest activity that never happened.
 */
const SERIES = [
  { key: 'totalIn', label: 'Money in', color: 'var(--color-debit)' },
  { key: 'totalOut', label: 'Money out', color: 'var(--color-credit)' },
] as const;

interface PlotDatum {
  bucket: string;
  label: string;
  totalIn: number;
  totalOut: number;
  /** Originals kept for display — the numbers above are only coordinates. */
  raw: TrendPoint;
}

export function TrendChart({
  points,
  granularity,
}: {
  points: TrendPoint[];
  granularity: 'day' | 'week' | 'month';
}) {
  const data = useMemo<PlotDatum[]>(
    () =>
      points.map((point) => ({
        bucket: point.bucket,
        label: formatBucket(point.bucket, granularity),
        totalIn: toPlotValue(point.totalIn),
        totalOut: toPlotValue(point.totalOut),
        raw: point,
      })),
    [points, granularity],
  );

  if (points.length === 0) {
    return (
      <p className="text-muted-foreground flex h-72 items-center justify-center text-sm">
        Nothing recorded in this period.
      </p>
    );
  }

  return (
    <div>
      {/* Legend is always present for two series, so identity is never
          carried by colour alone. */}
      <div className="mb-2 flex flex-wrap items-center gap-4">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            <span className="text-muted-foreground">{series.label}</span>
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={288}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />

          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
            tickFormatter={(value: number) => formatMoneyCompact(String(value))}
          />

          <Tooltip
            cursor={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0]?.payload as PlotDatum | undefined;
              if (!datum) return null;

              return (
                <ChartTooltip
                  title={datum.label}
                  rows={SERIES.map((series) => ({
                    key: series.key,
                    label: series.label,
                    value: datum.raw[series.key],
                    color: series.color,
                  }))}
                  footer={tooltipCount(datum.raw.transactionCount, 'entry')}
                />
              );
            }}
          />

          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={false}
              // Bigger than the mark so the point is easy to hit on a
              // touch screen, and ringed in the surface colour so it
              // reads as separate from the line it sits on.
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--color-background)' }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatBucket(bucket: string, granularity: 'day' | 'week' | 'month'): string {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;

  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}
