import { Archivo } from 'next/font/google';

/*
 * The public pages' typeface. Archivo's width axis gives headlines an
 * expanded, confident cut while body text stays at normal width. Shared so
 * the landing page and the sign-in pages load it once and look the same.
 */
export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
});
