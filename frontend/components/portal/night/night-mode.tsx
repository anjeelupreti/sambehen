'use client';

import { useEffect } from 'react';

/**
 * Puts the page in the portal's night look while the portal is open. The
 * inline script in the portal layout sets it before first paint; this
 * keeps it set through client navigation and removes it on the way out.
 */
export function NightMode() {
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.colorScheme;
    html.classList.add('night');
    html.style.colorScheme = 'dark';
    return () => {
      html.classList.remove('night');
      html.style.colorScheme = previous;
    };
  }, []);
  return null;
}
