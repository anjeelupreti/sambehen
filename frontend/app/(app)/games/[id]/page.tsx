import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';

import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/money';
import type { Game } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Game' };

export default async function GameDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let game: Game;
  try {
    game = await apiGet<Game>(`/team/games/${id}`);
  } catch {
    // A 404 here may mean the game does not exist, or is outside the
    // caller's scope. The API makes those indistinguishable on purpose.
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/games">
            <ArrowLeftIcon className="size-4" />
            All games
          </Link>
        </Button>

        <header>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{game.name}</h1>
          <p className="text-muted-foreground text-sm">
            The catalogue transactions record against.
          </p>
        </header>
      </div>

      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <Card className="col-span-4 md:col-span-5">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Code</span>
                <p className="mt-1 font-mono text-sm">{game.code}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Category</span>
                <p className="mt-1 text-sm">{game.category || '—'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <div className="mt-1">
                  <Badge variant={game.isActive ? 'default' : 'secondary'}>
                    {game.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Created At</span>
                <p className="mt-1 text-sm">{formatDate(game.createdAt)}</p>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Description</span>
              <p className="mt-1 text-sm">{game.description || 'No description provided.'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Profile-like Image Area in top right */}
        <Card className="col-span-3 md:col-span-2 flex flex-col items-center p-6 space-y-4">
          <div className="w-full aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center border shadow-sm relative">
            {game.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.imageUrl}
                alt={`${game.name} cover`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-muted-foreground text-sm">No image</span>
            )}
          </div>
          <div className="text-center w-full">
            <h3 className="font-semibold">{game.name}</h3>
            <p className="text-sm text-muted-foreground">{game.code}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
