import { Alfa_Slab_One, Archivo } from 'next/font/google';

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

/*
 * The player portal's display face: a heavy slab in the wood-type
 * tradition of frontier posters and old casino boards. Only for big
 * numbers and a few headings; everything else stays Archivo.
 */
export const slab = Alfa_Slab_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-alfa',
  display: 'swap',
});
