import type { Metadata } from 'next';
import Link from 'next/link';

import { ClickableRow } from '@/components/clickable-row';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
import { SortableHeader } from '@/components/filters/sortable-header';
import { PaginationControls } from '@/components/pagination-controls';
import { SearchField } from '@/components/search-field';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { GameActions } from '@/components/game-actions';
import { NewGameModal } from '@/components/forms/new-game-modal';
import { apiList } from '@/lib/api';
import { formatDate } from '@/lib/money';
import { getActor } from '@/lib/session';
import type { Game } from '@/lib/types';

export const metadata: Metadata = { title: 'Games' };

const STATE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Retired' },
];

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'isActive', label: 'State', labels: { true: 'Active', false: 'Retired' } },
  { param: 'category', label: 'Category' },
];

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const [actor, { data, meta }] = await Promise.all([
    getActor(),
    apiList<Game>('/team/games', {
      query: {
        page: first('page') ?? 1,
        limit: 20,
        search: first('search'),
        isActive: first('isActive'),
        category: first('category'),
        sortBy: first('sortBy'),
        sortOrder: first('sortOrder'),
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Games</h1>
          <p className="text-muted-foreground text-sm">
            {actor?.role === 'master'
              ? 'The catalogue transactions are recorded against.'
              : 'Read-only. Only a master can change the catalogue.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton exportKey="games" />
          {actor ? <NewGameModal actorRole={actor.role} /> : null}
        </div>
      </header>

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search name or code…" />
            <FilterSelect
              param="isActive"
              label="State"
              options={STATE_OPTIONS}
              anyLabel="Any state"
            />
          </FilterBar>

          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="name">Game</SortableHeader>
                <SortableHeader column="code">Code</SortableHeader>
                <SortableHeader column="category">Category</SortableHeader>
                <SortableHeader column="isActive">State</SortableHeader>
                <SortableHeader column="createdAt">Added</SortableHeader>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                    No games match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((game) => (
                  <ClickableRow key={game.id} href={`/games/${game.id}`}>
                    <TableCell>
                      <Link href={`/games/${game.id}`} className="font-medium hover:underline">
                        {game.name}
                      </Link>
                      {game.description ? (
                        <p className="text-muted-foreground max-w-md truncate text-xs">
                          {game.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground text-sm">
                      {game.code}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {game.category ?? '—'}
                    </TableCell>
                    <TableCell>
                      {game.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="outline">Retired</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(game.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <GameActions game={game} actorRole={actor?.role} />
                    </TableCell>
                  </ClickableRow>
                ))
              )}
            </TableBody>
          </Table>

          <PaginationControls meta={meta} />
        </CardContent>
      </Card>
    </div>
  );
}
