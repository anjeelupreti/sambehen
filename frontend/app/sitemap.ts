import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

const PAGES = [
  '',
  '/product',
  '/security',
  '/pricing',
  '/about',
  '/contact',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
  '/legal/responsible-gaming',
  '/legal/data-processing',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path.startsWith('/legal') ? 'yearly' : 'monthly',
    priority: path === '' ? 1 : path.startsWith('/legal') ? 0.3 : 0.7,
  }));
}
