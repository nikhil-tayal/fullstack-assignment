// PM2 process config for this project's two apps (web + api).
//
// The droplet is ~1GB RAM and already runs another PM2 app,
// easysupply-api (~110MB resident). That leaves little headroom, so both
// processes here get deliberately low heap caps and hard restart ceilings
// rather than the defaults — better to restart a process than let it push
// the box into OOM and take easysupply down with it.
//
// Both apps bind to 127.0.0.1: nginx is the only process allowed to listen
// on a public interface (80/443), so app ports (3000, 4001) stay internal.
module.exports = {
  apps: [
    {
      name: "assignment-web",
      // outputFileTracingRoot in next.config.mjs points tracing at the repo
      // root, so the standalone entrypoint lands nested under apps/web
      // inside the standalone dir (not at its top level).
      cwd: "/root/assignment/apps/web/.next/standalone/apps/web",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
      node_args: "--max-old-space-size=384",
      max_memory_restart: "400M",
      autorestart: true,
    },
    {
      name: "assignment-api",
      cwd: "/root/assignment/apps/api",
      script: "dist/main.js",
      env: {
        NODE_ENV: "production",
        PORT: "4001",
      },
      node_args: "--max-old-space-size=256",
      max_memory_restart: "300M",
      autorestart: true,
    },
  ],
};
