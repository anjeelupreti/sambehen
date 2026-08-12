import type { Metadata } from 'next';

import { ExportButton } from '@/components/export-button';
import { MessagingView } from '@/components/messaging/messaging-view';
import { TeamMessagingView } from '@/components/messaging/team-messaging-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiList } from '@/lib/api';
import { getActor } from '@/lib/session';
import type { Conversation } from '@/lib/types';

export const metadata: Metadata = { title: 'Messages' };

export default async function MessagesPage() {
  // The thread pane holds one conversation; the list is scrolled, not
  // paged, and searched client-side in MessagingView rather than via a
  // page reload — so it takes a single generous page rather than
  // pagination or query-string filters that would fight the live updates.
  const [{ data }, actor] = await Promise.all([
    apiList<Conversation>('/team/conversations', { query: { limit: 100 } }),
    getActor(),
  ]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-muted-foreground text-sm">
            Customers on one side, your own team on the other — a manager sees their runners&apos;
            customer conversations, and which staff member replied is recorded on every message.
          </p>
        </div>
        <ExportButton exportKey="conversations" />
      </header>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>
        <TabsContent value="customers">
          <MessagingView initialConversations={data} />
        </TabsContent>
        <TabsContent value="team">
          {actor ? <TeamMessagingView actorId={actor.id} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
