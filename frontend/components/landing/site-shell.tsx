import Link from 'next/link';
import type { ReactNode } from 'react';

import { Logo } from '@/components/logo';
import { archivo } from '@/lib/fonts';
import { SiteHeader } from './site-header';

export const COMPANY = {
  name: 'Howdi',
  product: 'Howdi chat',
  location: 'Texas, USA',
  domain: 'howdichat.com',
  salesEmail: 'hello@howdichat.com',
  privacyEmail: 'privacy@howdichat.com',
};

const FOOTER = [
  {
    title: 'Product',
    links: [
      ['/product', 'Product'],
      ['/security', 'Security'],
      ['/pricing', 'Pricing'],
      ['/login', 'Sign in'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['/about', 'About'],
      ['/contact', 'Contact'],
      ['/register', 'Create a player account'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['/legal/terms', 'Terms of service'],
      ['/legal/privacy', 'Privacy policy'],
      ['/legal/cookies', 'Cookie notice'],
      ['/legal/responsible-gaming', 'Responsible gaming'],
      ['/legal/data-processing', 'Data processing'],
    ],
  },
] as const;

/**
 * The frame every public page shares: the site's type and palette, the
 * header, and the footer with every product, company and legal link.
 * The palette is fixed light whatever the visitor's app theme.
 */
export function SiteShell({
  children,
  overlayHeader = false,
}: {
  children: ReactNode;
  overlayHeader?: boolean;
}) {
  return (
    <div
      className={`${archivo.variable} font-lp bg-lp-ground text-lp-text flex min-h-svh flex-col antialiased [color-scheme:light]`}
    >
      <a
        href="#main"
        className="bg-lp-primary sr-only z-50 rounded-lg px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteHeader overlay={overlayHeader} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-lp-line bg-lp-raised border-t">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 text-sm sm:px-6 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:px-8">
        <div className="max-w-xs">
          <Logo tone="site" />
          <p className="text-lp-dim mt-4 leading-relaxed">
            Live chat and player records for gaming operators, store by store.
          </p>
          <a
            href={`mailto:${COMPANY.salesEmail}`}
            className="text-lp-primary mt-4 inline-block font-medium hover:underline"
          >
            {COMPANY.salesEmail}
          </a>
        </div>
        {FOOTER.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2.5">
            <p className="font-semibold">{column.title}</p>
            {column.links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="text-lp-dim hover:text-lp-text w-fit transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-lp-line mx-auto flex w-full max-w-7xl flex-wrap justify-between gap-2 border-t px-4 py-6 text-xs sm:px-6 lg:px-8">
        <p className="text-lp-dim">
          © {new Date().getFullYear()} {COMPANY.name}. {COMPANY.location}.
        </p>
        <p className="text-lp-dim">
          {COMPANY.product} records play; it does not offer or run games.
        </p>
      </div>
    </footer>
  );
}

/** The opening of an inner page: its title and one line on what it covers. */
export function PageIntro({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <div className="border-lp-line border-b">
      <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:px-8 lg:pt-24 lg:pb-16">
        <h1 className="max-w-3xl text-4xl leading-[1.04] font-extrabold tracking-[-0.02em] text-balance [font-stretch:118%] sm:text-6xl">
          {title}
        </h1>
        {body && <p className="text-lp-dim mt-5 max-w-2xl text-lg leading-relaxed">{body}</p>}
      </div>
    </div>
  );
}

export const primaryButton =
  'bg-lp-primary text-white focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg px-6 font-semibold transition-colors hover:bg-lp-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2';
export const secondaryButton =
  'border-lp-line-strong bg-lp-raised hover:border-lp-dim focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg border px-6 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';
