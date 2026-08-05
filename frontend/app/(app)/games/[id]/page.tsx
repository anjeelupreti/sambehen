import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import type { Game } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function GameDetailsPage({ params }: { params: { id: string } }) {
  let game: Game;
  try {
    // Await params as per Next.js 15+ App Router rules
    const resolvedParams = await params;
    game = await apiGet<Game>(`/team/games/${resolvedParams.id}`);
  } catch {
    // A 404 here may mean the game does not exist, or is outside the
    // caller's scope. The API makes those indistinguishable on purpose.
    notFound();
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Game Details</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <Card className="col-span-4 md:col-span-5">
          <CardHeader>
            <CardTitle>{game.name}</CardTitle>
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
                <p className="mt-1 text-sm">{new Date(game.createdAt).toLocaleDateString()}</p>
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
