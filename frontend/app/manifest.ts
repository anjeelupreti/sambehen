import type { MetadataRoute } from 'next';

/**
 * Lets Howdi chat be added to a home screen and open like an app, mainly
 * for players on their phones. It starts at the home page, which sends a
 * signed-in player to their portal and staff to their dashboard.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Howdi chat',
    short_name: 'Howdi',
    description: 'Your balance, progress and messages with your store.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f7fb',
    theme_color: '#2f5bff',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
