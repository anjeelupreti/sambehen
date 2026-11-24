import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/** The public site is indexable; the app behind sign-in is not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/customers',
        '/messages',
        '/customer',
        '/api/',
        '/r/',
        '/unsubscribe',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
