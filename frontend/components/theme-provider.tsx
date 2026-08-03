'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Theme provider.
 *
 * `attribute="class"` because the token set in globals.css switches on a
 * `.dark` class, not a data attribute. Transitions are disabled during the
 * swap: animating every colour token at once reads as a flash of the wrong
 * palette rather than as a transition.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
