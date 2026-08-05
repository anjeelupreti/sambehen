'use client';

import { useState } from 'react';
import { EditIcon, EyeIcon } from 'lucide-react';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { EditGameModal } from '@/components/forms/edit-game-modal';
import type { Game, StaffRole } from '@/lib/types';

export function GameActions({
  game,
  actorRole,
  hideView,
}: {
  game: Game;
  actorRole?: StaffRole;
  hideView?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = actorRole === 'master';

  return (
    <div className="flex items-center justify-end gap-1">
      {!hideView && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          asChild
          aria-label={`View ${game.name}`}
        >
          <Link href={`/games/${game.id}`}>
            <EyeIcon className="size-4" />
          </Link>
        </Button>
      )}

      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setIsEditing(true)}
          aria-label={`Edit ${game.name}`}
        >
          <EditIcon className="size-4" />
        </Button>
      )}

      {/* Maintain dropdown if we need to add more actions in the future, 
          or just omit it if View and Edit are the only actions. 
          Actually, since View and Edit are the only actions right now, we can omit the dropdown entirely! */}

      {canEdit && <EditGameModal game={game} open={isEditing} onOpenChange={setIsEditing} />}
    </div>
  );
}
