import type { Metadata, Viewport } from 'next';

import { ServiceWorker } from '@/components/service-worker';
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
  applicationName: 'Howdi chat',
  appleWebApp: { capable: true, title: 'Howdi', statusBarStyle: 'default' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1322' },
  ],
  // Lets the portal's tab bar sit above the home indicator on phones.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes writes the theme class onto
    // <html> before React hydrates, so the server and client markup differ
    // here by design.
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      {/* Next streams page metadata into the body, where browsers ignore
          the manifest and home-screen tags; these must sit in the head for
          the app to be installable. */}
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Howdi" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster richColors closeButton position="top-right" />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
