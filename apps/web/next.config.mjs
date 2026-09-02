/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` emits .next/standalone with only the traced runtime deps, so
  // deploy.sh can rsync a self-contained server instead of installing
  // node_modules on the 1GB droplet.
  output: 'standalone',
  // The monorepo root, not apps/web, is what file tracing should walk.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  // `next dev` and `next build` both write to .next and clobber each other,
  // which leaves the running dev server throwing MODULE_NOT_FOUND. Dev sets
  // NEXT_DIST_DIR so the two can run side by side; prod keeps the default
  // .next that deploy.sh expects.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  // In dev the browser talks to Next on :3000 while Nest listens on :4001. Rather
  // than pointing the browser straight at the API — which needs an env file and a
  // CORS allowance — dev proxies /api through Next, so a fresh clone runs with
  // nothing to configure and the origin layout matches production, where nginx
  // serves both halves from one host. NEXT_PUBLIC_API_URL still overrides it.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const api = process.env.API_PROXY_URL ?? 'http://127.0.0.1:4001';
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
