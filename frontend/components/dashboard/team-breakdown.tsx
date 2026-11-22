import { Money } from '@/components/money';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCount } from '@/lib/money';
import type { TeamRollupRow } from '@/lib/types';

/**
 * The next level down the chain, side by side: managers for a master,
 * stores (plus their own customers) for a manager. A thin bar beside each
 * row shows its share of money in, so the biggest contributor reads first.
 */
export function TeamBreakdown({
  title,
  rows,
  viewerId,
}: {
  title: string;
  rows: TeamRollupRow[];
  viewerId: string;
}) {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => Number(b.totalIn) - Number(a.totalIn));
  // Display-only geometry for the share bars.
  const totalIn = sorted.reduce((sum, row) => sum + Math.max(Number(row.totalIn), 0), 0);

  return (
    <section aria-labelledby="team-title" className="bg-card rounded-xl border">
      <h2 id="team-title" className="px-5 pt-5 text-base font-semibold">
        {title}
      </h2>
      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Name</TableHead>
              <TableHead className="w-[28%]">Share of money in</TableHead>
              <TableHead className="text-right">Customers</TableHead>
              <TableHead className="text-right">Money in</TableHead>
              <TableHead className="text-right">Money out</TableHead>
              <TableHead className="pr-5 text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const share = totalIn > 0 ? Math.max(Number(row.totalIn), 0) / totalIn : 0;
              return (
                <TableRow key={row.staffId}>
                  <TableCell className="pl-5 font-medium">
                    {row.staffId === viewerId ? 'Your own customers' : row.username}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                        <div
                          className="bg-debit h-full rounded-full"
                          style={{ width: `${share * 100}%` }}
                        />
                      </div>
                      <span className="tabular text-muted-foreground w-10 text-right text-xs">
                        {Math.round(share * 100)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatCount(row.customerCount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.totalIn} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.totalOut} />
                  </TableCell>
                  <TableCell className="pr-5 text-right font-medium">
                    <Money value={row.balance} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
