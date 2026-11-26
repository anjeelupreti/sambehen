import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { MessagesWorkspace } from '@/components/messaging/messages-workspace';
import { apiList } from '@/lib/api';
import { getActor } from '@/lib/session';
import type { Conversation } from '@/lib/types';

export const metadata: Metadata = { title: 'Messages' };

export default async function MessagesPage() {
  // One generous page, searched client-side: the list is live-updated over
  // the socket, which pagination would fight.
  const [{ data }, actor] = await Promise.all([
    apiList<Conversation>('/team/conversations', { query: { limit: 100 } }),
    getActor(),
  ]);
  if (!actor) redirect('/logout');

  return (
    // Fills the viewport under the 3.5rem app header, inside main's padding.
    <div className="-m-4 h-[calc(100svh-3.5rem)] sm:-m-6">
      <MessagesWorkspace
        initialConversations={data}
        viewer={{ id: actor.id, username: actor.username, role: actor.role }}
      />
    </div>
  );
}
