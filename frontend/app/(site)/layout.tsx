import type { ReactNode } from 'react';

import { SmoothScroll } from '@/components/landing/motion';
import { SiteShell } from '@/components/landing/site-shell';

/** Every public page other than the home page: product, company and legal. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <SiteShell>
      <SmoothScroll />
      {children}
    </SiteShell>
  );
}
