import type { Metadata } from 'next';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Sambehen',
    template: '%s · Sambehen',
  },
  description: 'Data entry management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes writes the theme class onto
    // <html> before React hydrates, so the server and client markup differ
    // here by design.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * The accent preset (ThemeCustomizer, "sambehen-color-preset" in
         * localStorage) is a second, independent axis from next-themes'
         * light/dark — next-themes only bootstraps its own class before
         * paint, so without this, `data-theme-color` stayed unset until a
         * page happened to mount <ThemeCustomizer/>, and a page that didn't
         * (the welcome page, /login, ...) silently reverted to the default
         * indigo regardless of what the visitor had actually chosen.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var c=localStorage.getItem('sambehen-color-preset');if(c&&c!=='default')document.documentElement.setAttribute('data-theme-color',c);}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
