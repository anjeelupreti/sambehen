'use client';

import { useState } from 'react';
import Link from 'next/link';

import { ThemeCustomizer } from '@/components/theme-customizer';
import { cn } from '@/lib/utils';

type Audience = 'customer' | 'staff';

const DESTINATIONS: Record<Audience, { login: string; register: string | null }> = {
  customer: { login: '/customer/login', register: '/customer/register' },
  staff: { login: '/login', register: null },
};

/**
 * Two audiences share one front door, so the nav asks which one you are
 * rather than guessing. Staff accounts are never self-registered — a
 * master creates them — so "Register" only appears in customer mode
 * instead of leading to a form that would reject everyone who fills it in.
 */
export function SiteNavbar() {
  const [audience, setAudience] = useState<Audience>('customer');
  const dest = DESTINATIONS[audience];

  return (
    <header className="bg-background/80 sticky top-0 z-20 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md text-lg font-bold">
            S
          </div>
          <span className="text-lg font-bold tracking-tight">Sambehen</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            role="radiogroup"
            aria-label="I am a"
            className="bg-muted relative hidden grid-cols-2 items-center rounded-full p-1 text-sm font-medium sm:grid"
          >
            <div
              aria-hidden
              className={cn(
                'bg-background absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full shadow-sm transition-transform duration-300 ease-out',
                audience === 'staff' && 'translate-x-full',
              )}
            />
            {(['customer', 'staff'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={audience === option}
                onClick={() => setAudience(option)}
                className={cn(
                  'relative z-10 rounded-full px-4 py-1.5 capitalize transition-colors duration-300',
                  audience === option
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <ThemeCustomizer />

          <NavLink variant="ghost" href={dest.login} label="Log in" />
          {dest.register ? (
            <NavLink variant="primary" href={dest.register} label="Register" />
          ) : null}
        </div>
      </div>

      {/* Mobile audience toggle: the pill above is hidden below `sm`, so the
          choice moves inline here instead of disappearing. */}
      <div className="relative grid grid-cols-2 gap-1 border-t px-4 py-2 text-sm sm:hidden">
        <div
          aria-hidden
          className={cn(
            'bg-primary/10 absolute inset-y-1 left-4 w-[calc(50%-16px)] rounded-full transition-transform duration-300 ease-out',
            audience === 'staff' && 'translate-x-full',
          )}
        />
        {(['customer', 'staff'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setAudience(option)}
            className={cn(
              'relative z-10 rounded-full px-2.5 py-1 text-center font-medium capitalize transition-colors duration-300',
              audience === option ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </header>
  );
}

function NavLink({
  href,
  label,
  variant,
}: {
  href: string;
  label: string;
  variant: 'ghost' | 'primary';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'hover:bg-muted',
      )}
    >
      {label}
    </Link>
  );
}
