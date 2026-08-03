'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MenuIcon } from 'lucide-react';

import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { StaffRole } from '@/lib/types';

/**
 * Navigation for viewports below `md`, where the fixed sidebar is hidden.
 *
 * The drawer closes on navigation. Without that it stays open over the page
 * it just navigated to, which on a phone means the destination is completely
 * covered by the menu that opened it.
 */
export function MobileNav({ role }: { role: StaffRole }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 md:hidden" aria-label="Open menu">
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="h-14 justify-center border-b px-5">
          <SheetTitle className="text-left text-base tracking-tight">Sambehen</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto">
          <AppSidebar role={role} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
