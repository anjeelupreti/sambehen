import type { Metadata } from 'next';

import { PlayResponsibly } from '@/components/portal/play-responsibly';
import { WinsBoard } from '@/components/portal/wins-board';
import { customerGet } from '@/lib/customer-api';
import type { components } from '@/lib/api-schema';

type WinFeed = components['schemas']['WinFeedDto'];

export const metadata: Metadata = { title: 'Big wins' };

/** Real wins recorded by the team: this week's biggest and the latest. */
export default async function WinsPage() {
  const feed = await customerGet<WinFeed>('/me/wins').catch(
    () => ({ recent: [], topThisWeek: [], showMine: true }) as WinFeed,
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold [font-stretch:115%]">Big wins</h1>
      <WinsBoard recent={feed.recent} top={feed.topThisWeek} showMine={feed.showMine} />
      <PlayResponsibly />
    </div>
  );
}
