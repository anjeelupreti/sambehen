'use client';

import { useState } from 'react';
import { MoreHorizontalIcon, WrenchIcon } from 'lucide-react';

import { CorrectionModal } from '@/components/forms/correction-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Row actions for a recorded entry.
 *
 * Correcting is the only one. Amount, type and customer are immutable by
 * design — an edit would rewrite history, while a correction leaves both
 * figures visible and explains the difference.
 *
 * A correction cannot itself be corrected: the API refuses, and offering
 * the option would invite a chain nobody can read back.
 */
export function TransactionActions({
  transactionId,
  amount,
  customerUsername,
  isCorrection,
}: {
  transactionId: string;
  amount: string;
  customerUsername: string | null;
  isCorrection: boolean;
}) {
  const [correcting, setCorrecting] = useState(false);

  if (isCorrection) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Entry actions">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setCorrecting(true)}>
            <WrenchIcon className="size-4" />
            Correct this entry
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CorrectionModal
        transactionId={transactionId}
        originalAmount={amount}
        customerUsername={customerUsername}
        open={correcting}
        onOpenChange={setCorrecting}
      />
    </>
  );
}
