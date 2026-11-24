/** Where the public site is served. Set NEXT_PUBLIC_SITE_URL once the domain is live. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sambehen.up.railway.app'
).replace(/\/$/, '');
