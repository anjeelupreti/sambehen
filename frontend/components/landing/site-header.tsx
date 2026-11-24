import Link from 'next/link';
import { MenuIcon } from 'lucide-react';

import { Logo } from '@/components/logo';

export const SITE_NAV = [
  { href: '/product', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const focusRing =
  'focus-visible:outline-lp-primary rounded focus-visible:outline-2 focus-visible:outline-offset-4';

/** The public pages' header: logo, the site's pages, and sign-in. */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={
        overlay
          ? 'absolute inset-x-0 top-0 z-20'
          : 'border-lp-line bg-lp-ground/90 sticky top-0 z-20 border-b backdrop-blur'
      }
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className={focusRing}>
          <Logo tone="site" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 text-sm md:flex">
          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-lp-text/75 hover:text-lp-text font-medium transition-colors ${focusRing}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="bg-lp-primary focus-visible:outline-lp-primary hover:bg-lp-primary-hover inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Sign in
          </Link>
          <details className="group relative md:hidden">
            <summary
              aria-label="Menu"
              className={`grid size-9 cursor-pointer list-none place-items-center ${focusRing} [&::-webkit-details-marker]:hidden`}
            >
              <MenuIcon className="size-5" />
            </summary>
            <nav
              aria-label="Main"
              className="border-lp-line bg-lp-raised absolute right-0 mt-2 flex w-48 flex-col rounded-xl border p-2 shadow-lg"
            >
              {SITE_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:bg-lp-sunk rounded-lg px-3 py-2.5 text-sm font-medium"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/register"
                className="hover:bg-lp-sunk text-lp-dim rounded-lg px-3 py-2.5 text-sm"
              >
                Create a player account
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
