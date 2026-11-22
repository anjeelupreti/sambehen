import type { Metadata } from 'next';

import { CustomerThread } from '@/components/customer/customer-thread';

export const metadata: Metadata = { title: 'Messages' };

export default function CustomerMessagesPage() {
  return (
    // Fills the viewport under the portal header: 3.5rem header, plus the
    // main element's padding.
    <div className="bg-background -mx-4 -mt-4 -mb-10 flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden sm:mx-0 sm:mt-0 sm:mb-0 sm:h-[calc(100svh-3.5rem-3rem)] sm:rounded-2xl sm:border">
      <CustomerThread />
    </div>
  );
}
