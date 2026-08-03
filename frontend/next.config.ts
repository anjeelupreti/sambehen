import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The API is a separate deployable. Nothing here proxies to it: the
  // browser never calls it directly, so there is no CORS surface and no
  // rewrite to keep in sync. Server Components call it over the network
  // using the session cookie, and the token never reaches the client.
  //
  // Fail the build on type or lint errors rather than shipping them, which
  // matters more here than usual because the response envelope is typed by
  // hand against the backend's OpenAPI document.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  experimental: {
    // Server Actions receive the login form. Keep the payload small; this
    // is a credentials form, not an upload endpoint.
    serverActions: { bodySizeLimit: '1mb' },
  },
};

export default nextConfig;
