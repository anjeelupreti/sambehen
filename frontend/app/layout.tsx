import type { Metadata } from 'next';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { archivo } from '@/lib/fonts';
import { SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Howdi chat',
    template: '%s · Howdi chat',
  },
  description: 'Live chat and player records for gaming operators, store by store.',
  openGraph: { siteName: 'Howdi chat', type: 'website' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes writes the theme class onto
    // <html> before React hydrates, so the server and client markup differ
    // here by design.
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
