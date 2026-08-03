'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { ChartTooltip, tooltipCount } from '@/components/charts/chart-tooltip';
import { formatMoneyCompact, toPlotValue } from '@/lib/money';
import type { GameTotal } from '@/lib/types';

/**
 * Top games as a dot plot.
 *
 * A dot plot rather than bars: these are ranked totals that never start at
 * zero in the reader's mind, and the bar length invites a "twice as long =
 * twice as much" reading across two charts whose scales differ. A dot marks
 * the position and nothing more.
 *
 * Colour follows the measure, not the rank — the debit chart is always the
 * debit hue — so filtering the list never repaints the survivors.
 */
interface PlotDatum {
  game: string;
  total: number;
  raw: GameTotal;
}

export function GameDotPlot({ rows, measure }: { rows: GameTotal[]; measure: 'debit' | 'credit' }) {
  const color = measure === 'debit' ? 'var(--color-debit)' : 'var(--color-credit)';
  const label = measure === 'debit' ? 'Money in' : 'Money out';

  const data = useMemo<PlotDatum[]>(
    () =>
      // Ascending so the largest sits at the top of a category axis, which
      // recharts draws bottom-up.
      [...rows]
        .reverse()
        .map((row) => ({ game: row.gameName, total: toPlotValue(row.total), raw: row })),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        Nothing recorded yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 34 + 40)}>
      <ScatterChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />

        <XAxis
          type="number"
          dataKey="total"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          tickFormatter={(value: number) => formatMoneyCompact(String(value))}
        />
        <YAxis
          type="category"
          dataKey="game"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
        />
        {/* Fixed range keeps every dot one size — the dot marks a position,
            it does not encode a second measure. */}
        <ZAxis range={[110, 110]} />

        <Tooltip
          cursor={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const datum = payload[0]?.payload as PlotDatum | undefined;
            if (!datum) return null;

            return (
              <ChartTooltip
                title={datum.raw.gameName}
                rows={[{ key: 'total', label, value: datum.raw.total, color }]}
                footer={tooltipCount(datum.raw.transactionCount, 'entry')}
              />
            );
          }}
        />

        <Scatter
          data={data}
          fill={color}
          // Ringed in the surface colour so dots that land close together
          // stay visually separate.
          stroke="var(--color-card)"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
