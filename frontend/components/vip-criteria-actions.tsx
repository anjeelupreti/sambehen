'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { MoreHorizontalIcon, PencilIcon, RotateCcwIcon, TrashIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteVipCriteria, recomputeVipCriteria } from '@/app/(app)/vip-criteria/actions';
import type { VipCriteria } from '@/lib/types';
import { useRouter } from 'next/navigation';

export function VipCriteriaActions({ criteria }: { criteria: VipCriteria }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleRecompute = () => {
    startTransition(async () => {
      const result = await recomputeVipCriteria(criteria.id);

      if (result.ok && result.data) {
        toast.success(
          `Recomputed: ${result.data.qualified} qualified, ${result.data.removed} removed`,
        );
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.message);
      }
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        'Are you sure you want to delete this criteria? This will remove all qualifications for it.',
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteVipCriteria(criteria.id);

      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
          <MoreHorizontalIcon className="size-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/vip-criteria/${criteria.id}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit criteria
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleRecompute();
          }}
        >
          <RotateCcwIcon className="mr-2 size-4" />
          Recompute qualifications
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            handleDelete();
          }}
        >
          <TrashIcon className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
