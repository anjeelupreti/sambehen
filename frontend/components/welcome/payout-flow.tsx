'use client';

import { ArrowDownToLine, BadgeCheck, Banknote, ClipboardCheck } from 'lucide-react';

const STEPS = [
  { icon: ArrowDownToLine, label: 'Request' },
  { icon: ClipboardCheck, label: 'Team processes' },
  { icon: BadgeCheck, label: 'In your balance' },
];

/**
 * A withdrawal request moving through three real stages. The dash between
 * each node animates on a loop — decoration only, since actual processing
 * time depends on the request, not a fixed animation length.
 */
export function PayoutFlow() {
  return (
    <div className="bg-card rounded-2xl border p-8 shadow-lg transition-transform duration-500 hover:scale-[1.02]">
      <div className="flex items-center justify-between">
        {STEPS.map(({ icon: Icon, label }, index) => (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
                <Icon className="size-5" />
              </div>
              <span className="w-16 text-xs font-medium">{label}</span>
            </div>
            {index < STEPS.length - 1 ? (
              <div className="relative mx-1 mb-6 h-px w-8 overflow-hidden sm:w-14">
                <div className="bg-border absolute inset-0" />
                <div
                  className="bg-primary absolute inset-y-0 left-0 w-1/3 [animation:dash-travel_1.8s_ease-in-out_infinite]"
                  style={{ animationDelay: `${index * 0.3}s` }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t pt-6">
        <div className="flex items-center gap-2">
          <Banknote className="text-muted-foreground size-4" />
          <span className="text-muted-foreground text-sm">Every request is logged</span>
        </div>
        <span className="text-muted-foreground text-xs">Ledger updates instantly</span>
      </div>
    </div>
  );
}
