import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Logo } from '@/components/logo';
import { archivo } from '@/lib/fonts';

/**
 * The frame every sign-in page shares: the form on the left and, on large
 * screens, a panel of the home page's sky on the right with the mascot in
 * it. The sky ties the sign-in pages to the site they were reached from;
 * the panel carries no copy, since the form says everything needed.
 */
export function AuthShell({
  children,
  mascot = 'waving',
}: {
  children: ReactNode;
  /** The pose in the sky panel. */
  mascot?: 'waving' | 'door';
}) {
  return (
    <div
      className={`${archivo.variable} font-lp bg-lp-ground text-lp-text grid min-h-svh antialiased [color-scheme:light] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]`}
    >
      <div className="flex min-h-svh flex-col px-4 py-6 sm:px-10 lg:px-14">
        <Link
          href="/"
          className="focus-visible:outline-lp-primary w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Logo tone="site" />
        </Link>

        <main id="main" className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </main>

        <footer className="text-lp-dim flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
          <p>© {new Date().getFullYear()} Howdi</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/legal/terms" className="hover:text-lp-text">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-lp-text">
              Privacy
            </Link>
            <Link href="/contact" className="hover:text-lp-text">
              Contact
            </Link>
          </nav>
        </footer>
      </div>

      <aside aria-hidden className="sticky top-0 hidden h-svh p-3 lg:block">
        <div className="lp-grain relative h-full overflow-hidden rounded-[2rem]">
          <Image
            src="/brand/sky.webp"
            alt=""
            fill
            priority
            unoptimized
            sizes="55vw"
            className="-z-10 object-cover object-[30%_top]"
          />
          <div className="relative z-10 flex h-full items-center justify-center p-12">
            <Image
              src={`/brand/mascot/${mascot}.webp`}
              alt=""
              width={480}
              height={480}
              priority
              className="w-[min(26rem,70%)] drop-shadow-[0_40px_50px_rgb(18_26_43/0.25)] select-none"
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
