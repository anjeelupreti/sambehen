'use client';

import { useState } from 'react';
import { BarChart3Icon, TableIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * A chart with a table view of the same data.
 *
 * The table is not a fallback for a broken chart — it is how the figures
 * stay available to a screen reader, to anyone who cannot separate the two
 * series by colour, and to whoever needs to read an exact number off a
 * chart that only shows position.
 */
export function ChartCard({
  title,
  description,
  controls,
  chart,
  table,
}: {
  title: string;
  description?: string;
  controls?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  return (
    <Card className="gap-4">
      {/* CardHeader is flex-col by default; the controls belong beside the
          title, and wrap beneath it when the header runs out of width. */}
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <p className="text-muted-foreground mt-1 text-xs">{description}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {controls}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
                aria-label={view === 'chart' ? 'Show as table' : 'Show as chart'}
              >
                {view === 'chart' ? <TableIcon /> : <BarChart3Icon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{view === 'chart' ? 'Show as table' : 'Show as chart'}</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent>{view === 'chart' ? chart : table}</CardContent>
    </Card>
  );
}
