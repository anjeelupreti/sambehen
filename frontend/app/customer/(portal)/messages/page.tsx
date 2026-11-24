import type { Metadata } from 'next';

import { CustomerThread } from '@/components/customer/customer-thread';

export const metadata: Metadata = { title: 'Messages' };

export default function CustomerMessagesPage() {
  return (
    // Fills the screen between the 3.5rem header and, on phones, the 4rem
    // tab bar; from tablet width up it sits in main's padding as a card.
    <div className="bg-background -mx-4 -mt-4 -mb-[calc(5.5rem+env(safe-area-inset-bottom))] flex h-[calc(100svh-7.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden md:mx-0 md:mt-0 md:mb-0 md:h-[calc(100svh-3.5rem-4rem)] md:rounded-2xl md:border">
      <CustomerThread />
    </div>
  );
}
