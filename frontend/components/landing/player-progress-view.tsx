import Image from 'next/image';
import { CheckIcon } from 'lucide-react';

import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

const TIERS = [
  { name: 'Bronze', reached: true },
  { name: 'Silver', reached: true },
  { name: 'Gold', reached: false },
];

const MEDALS = [
  { key: 'joined', label: 'Joined', earned: true },
  { key: 'first_message', label: 'First message', earned: true },
  { key: 'first_referral', label: 'First friend', earned: true },
  { key: 'three_months', label: '3 months', earned: false },
];

/** The player portal's home as a player sees it on their phone, with example data. */
export function PlayerProgressView() {
  return (
    <div className="border-lp-line bg-lp-raised mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] border shadow-[0_30px_70px_-40px_rgb(18_26_43/0.45)]">
      <div className="border-lp-line flex items-center justify-between border-b px-5 py-3.5">
        <Logo tone="site" size="sm" />
        <span className="text-lp-dim text-xs">Store 11</span>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/mascot/waving.webp"
            alt=""
            width={96}
            height={96}
            className="-my-2 size-12"
          />
          <p className="text-xl font-bold [font-stretch:115%]">Howdy, Savannah</p>
        </div>

        <div className="border-lp-line rounded-2xl border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">VIP</span>
            <span className="bg-lp-chip text-lp-text rounded-full px-2.5 py-0.5 text-xs font-bold">
              Silver
            </span>
          </div>
          <ol className="mt-4 flex items-start">
            {TIERS.map((tier, index) => (
              <li key={tier.name} className="relative flex flex-1 flex-col items-center">
                {index > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-3.5 right-1/2 h-1 w-full -translate-y-1/2 rounded-full',
                      tier.reached ? 'bg-lp-chip' : 'bg-lp-sunk',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 grid size-7 place-items-center rounded-full text-xs font-bold',
                    tier.reached
                      ? 'bg-lp-chip text-lp-text'
                      : 'bg-lp-raised text-lp-primary ring-lp-primary ring-2',
                  )}
                >
                  {tier.reached ? <CheckIcon className="size-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className="mt-1.5 text-[11px] font-semibold">{tier.name}</span>
              </li>
            ))}
          </ol>
          <div className="bg-lp-sunk mt-4 rounded-xl p-3">
            <div className="flex justify-between text-xs">
              <span className="font-semibold">Next: Gold</span>
              <span className="text-lp-dim tabular">72%</span>
            </div>
            <div className="bg-lp-raised mt-1.5 h-2 overflow-hidden rounded-full">
              <div className="bg-lp-primary h-full w-[72%] rounded-full" />
            </div>
          </div>
        </div>

        <div className="border-lp-line rounded-2xl border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Milestones</span>
            <span className="text-lp-dim tabular text-xs">3 of 8</span>
          </div>
          <ul className="mt-3 grid grid-cols-4 gap-1">
            {MEDALS.map((medal) => (
              <li key={medal.key} className="flex flex-col items-center text-center">
                <Image
                  src={`/brand/badges/${medal.key}.webp`}
                  alt=""
                  width={128}
                  height={128}
                  className={cn('size-12', !medal.earned && 'opacity-40 grayscale')}
                />
                <span
                  className={cn(
                    'mt-1 text-[10px] leading-tight',
                    medal.earned ? 'font-semibold' : 'text-lp-dim',
                  )}
                >
                  {medal.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-lp-line rounded-2xl border p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Invite friends</span>
            <span className="text-lp-ok text-xs font-semibold">$25.00 each</span>
          </div>
          <p className="mt-2 text-sm">
            <span className="text-lg font-bold">3</span>
            <span className="text-lp-dim"> of 5 friends joined</span>
          </p>
          <div className="bg-lp-sunk mt-1.5 h-2 overflow-hidden rounded-full">
            <div className="bg-lp-ok h-full w-3/5 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
