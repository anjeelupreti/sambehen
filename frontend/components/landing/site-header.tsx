'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MenuIcon, XIcon } from 'lucide-react';

import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

export const SITE_NAV = [
  { href: '/product', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const focusRing =
  'focus-visible:outline-lp-primary focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * The public site's navigation: a floating bar that sits over the page
 * rather than across it, so the home page's sky runs up behind it. It
 * gains a firmer edge once the page scrolls, and opens into a panel on
 * phones.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        className={cn(
          'mx-auto w-full max-w-6xl rounded-2xl border transition-[background-color,box-shadow,border-color] duration-300',
          scrolled || open
            ? 'border-lp-line bg-white/90 shadow-[0_12px_32px_-18px_rgb(18_26_43/0.35)] backdrop-blur-xl'
            : 'border-white/80 bg-white/85 shadow-[0_8px_24px_-20px_rgb(18_26_43/0.4)] backdrop-blur-lg',
        )}
      >
        <div className="flex h-14 items-center gap-3 pr-2 pl-3 sm:gap-6 sm:pl-4">
          <Link
            href="/"
            className={cn('shrink-0 rounded-md', focusRing)}
            aria-label="Howdi chat home"
          >
            <Logo tone="site" />
          </Link>

          <nav aria-label="Main" className="mx-auto hidden items-center gap-1 md:flex">
            {SITE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(item.href) ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-[15px] font-medium transition-colors',
                  focusRing,
                  active(item.href)
                    ? 'bg-lp-primary/10 text-lp-primary-hover'
                    : 'text-lp-text/80 hover:bg-lp-sunk hover:text-lp-text',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            <Link
              href="/login"
              className={cn(
                'text-lp-text/80 hover:bg-lp-sunk hover:text-lp-text hidden rounded-lg px-3.5 py-2 text-[15px] font-medium transition-colors sm:inline-flex',
                focusRing,
              )}
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className={cn(
                'bg-lp-primary hover:bg-lp-primary-hover hidden h-9 shrink-0 min-[350px]:inline-flex items-center rounded-xl px-3 text-sm font-semibold whitespace-nowrap text-white transition-colors sm:h-10 sm:px-4 sm:text-[15px]',
                focusRing,
              )}
            >
              Book a demo
            </Link>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className={cn(
                'hover:bg-lp-sunk grid size-10 place-items-center rounded-xl md:hidden',
                focusRing,
              )}
            >
              {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="site-menu"
            aria-label="Main"
            className="border-lp-line flex flex-col gap-1 border-t p-2 md:hidden"
          >
            {SITE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(item.href) ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-3 text-base font-medium',
                  active(item.href) ? 'bg-lp-primary/10 text-lp-primary-hover' : 'hover:bg-lp-sunk',
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="hover:bg-lp-sunk rounded-lg px-3 py-3 text-base font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className="bg-lp-primary rounded-lg px-3 py-3 text-base font-semibold text-white min-[350px]:hidden"
            >
              Book a demo
            </Link>
            <Link
              href="/register"
              className="text-lp-dim hover:bg-lp-sunk rounded-lg px-3 py-3 text-base"
            >
              Create a player account
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
