import { KeyRoundIcon, ShieldCheckIcon, UserRoundIcon, UsersRoundIcon } from 'lucide-react';

const SIDES = [
  {
    icon: UserRoundIcon,
    label: 'Your account',
    detail: 'Your threads, your history, nothing else.',
  },
  {
    icon: UsersRoundIcon,
    label: 'The team',
    detail: 'Only the people assigned to you.',
  },
];

/**
 * The two sign-in realms, drawn side by side.
 *
 * This is a real property of the system rather than a reassurance: staff
 * and customer sessions are signed with different keys, so a token from
 * one side is rejected on the other at signature verification — not by a
 * check that a forged token could talk its way past.
 */
export function SecureRealms() {
  return (
    <div className="bg-card rounded-2xl border p-6 shadow-lg sm:p-8">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        {SIDES.map((side, index) => (
          <div key={side.label} className="contents">
            <div className="bg-muted/40 space-y-2 rounded-xl border p-4 text-center">
              <span className="bg-primary/10 text-primary mx-auto grid size-10 place-items-center rounded-full">
                <side.icon className="size-5" />
              </span>
              <p className="text-sm font-semibold">{side.label}</p>
              <p className="text-muted-foreground text-xs">{side.detail}</p>
            </div>

            {index === 0 ? (
              <div className="flex items-center justify-center gap-2 sm:flex-col">
                <span className="bg-border h-px w-8 sm:h-8 sm:w-px" />
                <span className="text-muted-foreground grid size-9 place-items-center rounded-full border">
                  <KeyRoundIcon className="size-4" />
                </span>
                <span className="bg-border h-px w-8 sm:h-8 sm:w-px" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-6 flex items-start gap-2 border-t pt-5 text-sm">
        <ShieldCheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
        Each side signs in with its own key. A session from one is not a session on the other.
      </p>
    </div>
  );
}
