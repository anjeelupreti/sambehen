/* eslint-disable @next/next/no-img-element -- small static artwork */
import {
  CalendarCheckIcon,
  CalendarHeartIcon,
  DoorOpenIcon,
  MessageCircleIcon,
  PartyPopperIcon,
  StarIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

export interface Milestone {
  key: string;
  achievedAt: string | null;
  current: number;
  target: number;
}

const META: Record<string, { label: string; icon: LucideIcon }> = {
  joined: { label: 'Joined', icon: DoorOpenIcon },
  first_message: { label: 'First message', icon: MessageCircleIcon },
  first_referral: { label: 'First friend', icon: UserPlusIcon },
  five_referrals: { label: 'Crew of five', icon: UsersIcon },
  vip: { label: 'Made VIP', icon: StarIcon },
  three_months: { label: '3 months', icon: CalendarCheckIcon },
  six_months: { label: '6 months', icon: CalendarHeartIcon },
  one_year: { label: '1 year', icon: PartyPopperIcon },
};

const TIME_BASED = new Set(['three_months', 'six_months', 'one_year']);

const monthYear = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

/**
 * Earned and upcoming milestones as a shelf of medals. Earned ones are gold
 * with the month they were earned; the rest are outlined with progress
 * where there is something to count. Artwork in public/brand/badges/ takes
 * over from the icons once it exists.
 */
export function Milestones({
  milestones,
  art,
}: {
  milestones: Milestone[];
  art: Record<string, string | null>;
}) {
  const earned = milestones.filter((m) => m.achievedAt).length;

  return (
    <section aria-labelledby="milestones-title" className="bg-card rounded-2xl border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="milestones-title" className="text-base font-semibold">
          Milestones
        </h2>
        <span className="text-muted-foreground tabular text-sm">
          {earned} of {milestones.length}
        </span>
      </div>

      <ul className="mt-4 grid grid-cols-4 gap-x-1 gap-y-5 md:grid-cols-8">
        {milestones.map((m) => {
          const meta = META[m.key] ?? { label: m.key, icon: StarIcon };
          const Icon = meta.icon;
          const done = Boolean(m.achievedAt);
          const image = art[m.key];
          const monthsLeft = m.target - m.current;
          const detail = done
            ? monthYear(m.achievedAt!)
            : TIME_BASED.has(m.key)
              ? monthsLeft <= 1
                ? 'Next month'
                : `In ${monthsLeft} months`
              : m.target > 1
                ? `${m.current} of ${m.target}`
                : 'Not yet';

          return (
            <li key={m.key} className="flex min-w-0 flex-col items-center text-center">
              <span
                className={cn(
                  'grid size-14 place-items-center rounded-full',
                  image
                    ? !done && 'opacity-40 grayscale'
                    : done
                      ? 'bg-highlight text-highlight-foreground shadow-[inset_0_-3px_0_rgb(0_0_0/0.12)]'
                      : 'text-muted-foreground border-2 border-dashed',
                )}
              >
                {image ? (
                  <img src={image} alt="" className="size-16 max-w-none" />
                ) : (
                  <Icon className="size-6" strokeWidth={done ? 2.25 : 1.75} aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  'mt-2 text-xs leading-tight',
                  done ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {meta.label}
              </span>
              <span className="text-muted-foreground tabular mt-0.5 text-[11px]">
                {done ? <span className="sr-only">Earned </span> : null}
                {detail}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
