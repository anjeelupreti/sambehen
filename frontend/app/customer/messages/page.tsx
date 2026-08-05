import type { Metadata } from 'next';

import { CustomerThread } from '@/components/customer/customer-thread';
import { loadMyMessages } from './actions';

export const metadata: Metadata = { title: 'Messages' };

export default async function CustomerMessagesPage() {
  const messages = await loadMyMessages();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-muted-foreground text-sm">
          One thread with the team. Replies arrive live.
        </p>
      </header>

      <CustomerThread initialMessages={messages} />
    </div>
  );
}
