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
};

export default nextConfig;
