import type { Metadata } from 'next';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { archivo } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Sambehen',
    template: '%s · Sambehen',
  },
  description: 'Player data and messaging for gaming operators.',
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
