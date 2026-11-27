import type { Metadata } from 'next';

import { ChatAvatar } from '@/components/chat/avatar';
import { Money } from '@/components/money';
import { PaginationControls } from '@/components/pagination-controls';
import { Card, CardContent } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/info-tip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RecordWinModal } from '@/components/wins/record-win-modal';
import { DeleteWinButton, WinShownSwitch } from '@/components/wins/win-row-actions';
import { apiList } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/money';
import type { Game } from '@/lib/types';
import type { StaffWin } from './actions';

export const metadata: Metadata = { title: 'Big wins' };

/**
 * Wins staff have recorded. Each one appears in the players' wins ticker
 * and board by first name and last initial, unless hidden here or by the
 * player.
 */
export default async function WinsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Array.isArray(params.page) ? params.page[0] : params.page;

  const [{ data, meta }, { data: games }] = await Promise.all([
    apiList<StaffWin>('/team/wins', { query: { page: page ?? 1, limit: 20 } }),
    apiList<Game>('/team/games', { query: { limit: 100, isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-semibold">Big wins</h1>
          <InfoTip>
            Players see recorded wins in their app as a live ticker and a wins board, by first name
            and last initial. Players can opt out of being shown.
          </InfoTip>
        </div>
        <RecordWinModal games={games} />
      </header>

      <Card className="py-0">
        <CardContent className="p-0">
          {data.length === 0 ? (
            <p className="text-muted-foreground px-6 py-14 text-center text-sm">
              No wins recorded yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Player</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="hidden md:table-cell">When</TableHead>
                  <TableHead className="hidden lg:table-cell">Recorded by</TableHead>
                  <TableHead>Shown</TableHead>
                  <TableHead className="w-12 pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((win) => {
                  const label = `${win.customerName}'s ${formatMoney(win.amount)} win`;
                  return (
                    <TableRow key={win.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <ChatAvatar
                            name={win.customerName}
                            src={win.customerAvatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{win.customerName}</p>
                            <p className="text-muted-foreground truncate text-xs">
                              {win.customerShowsWins ? win.customerUsername : 'Hides their wins'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{win.gameName ?? '—'}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        <Money value={win.amount} />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {formatDateTime(win.wonAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {win.recordedBy ?? '—'}
                      </TableCell>
                      <TableCell>
                        <WinShownSwitch id={win.id} hidden={win.hidden} label={label} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <DeleteWinButton id={win.id} label={label} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {meta.totalPages > 1 && <PaginationControls meta={meta} />}
    </div>
  );
}
