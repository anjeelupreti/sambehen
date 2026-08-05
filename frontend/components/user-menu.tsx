'use client';

import { useState, useTransition } from 'react';
import { LogOutIcon, UserIcon } from 'lucide-react';

import { signOut } from '@/app/(app)/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StaffRole } from '@/lib/types';
import { EditProfileModal } from '@/components/forms/edit-profile-modal';

/**
 * Identity and sign-out.
 *
 * The username collapses into the avatar below `sm`: on a narrow header it
 * is the first thing that pushes the controls off-screen, and the same name
 * is still shown inside the menu.
 */
export function UserMenu({ username, role }: { username: string; role: StaffRole }) {
  const [pending, startTransition] = useTransition();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <span className="bg-muted flex size-6 items-center justify-center rounded-full">
              <UserIcon className="size-3.5" />
            </span>
            <span className="hidden max-w-32 truncate sm:inline">{username}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-1.5">
            <span className="truncate font-medium">{username}</span>
            <Badge variant="secondary" className="w-fit capitalize">
              {role}
            </Badge>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setIsProfileOpen(true)}>
            <UserIcon className="size-4" />
            My Profile
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={pending}
            onSelect={(event) => {
              // Keeps the menu mounted while the server action runs, so the
              // disabled state is visible instead of the menu vanishing with
              // no sign anything happened.
              event.preventDefault();
              startTransition(() => void signOut());
            }}
          >
            <LogOutIcon className="size-4" />
            {pending ? 'Signing out…' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileModal
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        initialData={{ username }}
      />
    </>
  );
}
