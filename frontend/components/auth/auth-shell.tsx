import { existsSync } from 'fs';
import { join } from 'path';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { archivo } from '@/lib/fonts';
import { Logo } from '@/components/logo';

/**
 * The frame every sign-in page shares: the form on the left and, on large
 * screens, an illustration panel on the right. Uses the landing page's
 * tokens and type so the two read as one product.
 */
export function AuthShell({
  children,
  art,
  artClassName,
}: {
  children: ReactNode;
  /** File name in public/landing/; the panel renders without it. */
  art?: string;
  /** Nudges an illustration whose subject is not centred in its canvas. */
  artClassName?: string;
}) {
  const artSrc =
    art && existsSync(join(process.cwd(), 'public', 'landing', art)) ? `/landing/${art}` : null;

  return (
    <div
      className={`${archivo.variable} font-lp bg-lp-ground text-lp-text grid min-h-svh antialiased [color-scheme:light] lg:grid-cols-2`}
    >
      <div className="flex min-h-svh flex-col px-4 py-6 sm:px-10 lg:px-14">
        <Link
          href="/"
          className="focus-visible:outline-lp-primary w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Logo tone="site" />
        </Link>

        <main className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </main>

        <p className="text-lp-dim text-xs">© {new Date().getFullYear()} Howdi chat</p>
      </div>

      <aside className="hidden p-3 lg:block">
        <div className="bg-lp-sunk flex h-full items-center justify-center rounded-3xl px-12 py-16 text-center">
          {artSrc && (
            <Image
              src={artSrc}
              alt=""
              width={1200}
              height={1200}
              priority
              className={`w-full max-w-sm select-none ${artClassName ?? ''}`}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
