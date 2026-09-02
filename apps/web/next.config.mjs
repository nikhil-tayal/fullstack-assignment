/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` emits .next/standalone with only the traced runtime deps, so
  // deploy.sh can rsync a self-contained server instead of installing
  // node_modules on the 1GB droplet.
  output: 'standalone',
  // The monorepo root, not apps/web, is what file tracing should walk.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
};

export default nextConfig;
