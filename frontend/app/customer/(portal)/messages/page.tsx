import type { Metadata } from 'next';

import { CustomerThread } from '@/components/customer/customer-thread';
import { loadMyMessages } from './actions';

export const metadata: Metadata = { title: 'Messages' };

export default async function CustomerMessagesPage() {
  const messages = await loadMyMessages();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Messages</h1>
      </header>

      <CustomerThread initialMessages={messages} />
    </div>
  );
}
