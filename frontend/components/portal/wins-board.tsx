'use client';

import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { setShowMyWins } from '@/app/customer/(portal)/wins/actions';
import { InfoTip } from '@/components/ui/info-tip';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ago, winAmount } from './night/format';
import { GameMark } from './night/game-mark';
import { useLiveWins, type FeedWin } from './night/use-live-wins';

const name = (win: FeedWin) => (win.mine ? 'You' : win.displayName);

function Leader({ win, rank }: { win: FeedWin; rank: number }) {
  if (rank === 1) {
    return (
      <li className="bg-card relative col-span-2 flex items-center gap-4 overflow-hidden rounded-2xl border border-gold/50 p-4">
        <GameMark name={win.gameName} src={win.gameImageUrl} className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="font-slab text-3xl text-gold">{winAmount(win.amount)}</p>
          <p className="truncate text-sm">
            <span className="font-semibold">{name(win)}</span>
            {win.gameName && <span className="text-muted-foreground"> · {win.gameName}</span>}
          </p>
        </div>
        <span className="self-start text-xs font-bold text-gold" aria-label="Number 1">
          #1
        </span>
      </li>
    );
  }
  return (
    <li className="bg-card min-w-0 rounded-2xl border p-4">
      <div className="flex items-start justify-between">
        <GameMark
          name={win.gameName}
          src={win.gameImageUrl}
          className="size-9 rounded-lg text-xs"
        />
        <span className="text-muted-foreground text-xs font-bold" aria-label={`Number ${rank}`}>
          #{rank}
        </span>
      </div>
      <p className="font-slab mt-3 text-xl text-gold">{winAmount(win.amount)}</p>
      <p className="truncate text-sm font-semibold">{name(win)}</p>
      {win.gameName && <p className="text-muted-foreground truncate text-xs">{win.gameName}</p>}
    </li>
  );
}

function ShowMine({ initial }: { initial: boolean }) {
  const id = useId();
  const [show, setShow] = useState(initial);
  return (
    <div className="bg-card flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-5">
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="font-normal">
          Show my wins
        </Label>
        <InfoTip>
          Your wins appear here and in the ticker as your first name and last initial.
        </InfoTip>
      </div>
      <Switch
        id={id}
        checked={show}
        onCheckedChange={async (next) => {
          setShow(next);
          if (!(await setShowMyWins(next))) {
            setShow(!next);
            toast.error('That didn’t save. Try again.');
          }
        }}
      />
    </div>
  );
}

/** This week's biggest, then everything recent as it comes in. */
export function WinsBoard({
  recent,
  top,
  showMine,
}: {
  recent: FeedWin[];
  top: FeedWin[];
  showMine: boolean;
}) {
  const live = useLiveWins(recent);
  // Times are relative to now, so they are filled in after load (and kept
  // fresh) rather than rendered on the server, where "now" differs.
  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {top.length > 0 && (
        <section aria-labelledby="top-title" className="space-y-3">
          <h2
            id="top-title"
            className="text-[11px] font-bold tracking-[0.16em] text-gold uppercase"
          >
            <span aria-hidden>★ </span>This week’s biggest
          </h2>
          <ol className="grid grid-cols-2 gap-3">
            {top.slice(0, 3).map((win, index) => (
              <Leader key={win.id} win={win} rank={index + 1} />
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="recent-title" className="space-y-3">
        <h2
          id="recent-title"
          className="text-muted-foreground text-[11px] font-bold tracking-[0.16em] uppercase"
        >
          Recent
        </h2>
        {live.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-2xl border px-5 py-10 text-center text-sm">
            No big wins yet
          </p>
        ) : (
          <ul className="bg-card divide-y rounded-2xl border">
            {live.map((win) => (
              <li key={win.id} className="flex items-center gap-3 px-4 py-3">
                <GameMark name={win.gameName} src={win.gameImageUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold">{name(win)}</span>
                    <span className="text-muted-foreground"> won</span>
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {win.gameName ?? 'Big win'}
                    {mounted && ` · ${ago(win.wonAt)}`}
                  </p>
                </div>
                <span className="font-slab text-lg text-gold">{winAmount(win.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ShowMine initial={showMine} />
    </div>
  );
}
