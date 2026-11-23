import Link from 'next/link';
import { Logo } from '@/components/logo';

const NAV = [
  { href: '#chat', label: 'Chat' },
  { href: '#platform', label: 'Platform' },
  { href: '#dashboard', label: 'Dashboard' },
  { href: '#players', label: 'Players' },
  { href: '#access', label: 'Access' },
  { href: '#questions', label: 'Questions' },
];

export function SiteHeader() {
  return (
    <header className="border-lp-line bg-lp-ground/90 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="focus-visible:outline-lp-primary rounded focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Logo tone="site" />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-7 text-sm md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-lp-dim hover:text-lp-text focus-visible:outline-lp-primary rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/register"
            className="text-lp-dim hover:text-lp-text focus-visible:outline-lp-primary rounded text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="bg-lp-primary text-white focus-visible:outline-lp-primary inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold transition-colors hover:bg-lp-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
