# Deploying

## Architecture

```
Internet → nginx (80/443, "assignment" site) ──/api/*──→ 127.0.0.1:4001  (assignment-api, Nest)
                                              └──/*──────→ 127.0.0.1:3000  (assignment-web, Next standalone)
```

nginx is the only process with a public listener. Both apps bind to
`127.0.0.1` and are process-managed by pm2.

This droplet also hosts **easysupply.in** (nginx site `easysupply`, pm2 app
`easysupply-api` on port 4000). `deploy.sh` and `ecosystem.config.cjs` are
scoped to this project only — they never edit the `easysupply` nginx site,
never touch the `easysupply-api` pm2 process, and never remove anything in
`sites-enabled` that isn't `assignment`.

## One-time setup: DNS

Before the first deploy (or before HTTPS will work), add an A record:

| Type | Name         | Value           |
|------|--------------|-----------------|
| A    | `assignment` | `64.227.159.81` |

This should resolve `assignment.nikhiltayal.info` to the droplet. Until it
does, `deploy.sh` ships the app over plain HTTP and skips certbot — it will
pick up HTTPS automatically on a later run once DNS propagates.

## Deploying

```
./deploy.sh
```

This builds both apps locally, rsyncs the output to the droplet, installs
API dependencies on the server (web is a self-contained `standalone` bundle
and needs none), writes the nginx site on first run only, reloads nginx,
restarts both pm2 apps, and requests a Let's Encrypt cert once DNS is live.
Safe to re-run — every step is idempotent.

To use a different certbot contact email:

```
CERTBOT_EMAIL=you@example.com ./deploy.sh
```

## The database

The registry is a SQLite file at `/root/assignment/apps/api/prisma/registry.db` on
the droplet. It is deliberately **not** part of the rsync: a deploy ships code, and
overwriting the file would throw away whatever was uploaded through the running app.

`deploy.sh` syncs `schema.prisma` and the `migrations/` directory instead, then runs
`prisma migrate deploy` on the server. That creates the file on a first deploy and is
a no-op on every later one. `DATABASE_URL` is set in `ecosystem.config.cjs` rather
than in a `.env` on the box, so pm2 and the migration step cannot drift apart.

To start the deployed registry from scratch, delete that file and restart
`assignment-api` — the app comes back up empty and says so.

## Logs / process management

```
pm2 logs assignment-web
pm2 logs assignment-api
pm2 restart assignment-web
pm2 restart assignment-api
pm2 ls
```

Do not `pm2 delete` or restart `easysupply-api` from here — it's a separate
project sharing the box.

## Troubleshooting

- **502 from nginx**: check `pm2 ls` — is the relevant app `online`? Check
  `pm2 logs <app>` for a crash.
- **HTTPS not working**: confirm the A record above has propagated
  (`dig +short A assignment.nikhiltayal.info`), then re-run `./deploy.sh`.
- **nginx config test fails on deploy**: the script leaves the previously
  running nginx config untouched and warns instead of reloading — nothing
  goes down, but the new site config wasn't applied. Fix
  `/etc/nginx/sites-available/assignment` on the box and `nginx -t` it
  manually.

## Source of truth

The code lives at
[github.com/nikhil-tayal/fullstack-assignment](https://github.com/nikhil-tayal/fullstack-assignment).

The droplet does **not** pull from GitHub. `deploy.sh` builds on your machine and
rsyncs the artifacts up, because a Next build on this box peaks around 460MB and
takes ~2m16s — survivable, but uncomfortably close to the limit while easysupply
and the two app processes are also resident.

The practical consequence: pushing to GitHub and deploying are separate actions.
`deploy.sh` warns when the working tree is dirty or has unpushed commits, so the
repo a reviewer reads doesn't silently drift from what's actually running. Push
first, then deploy.

## Gotcha: NEXT_PUBLIC_* is baked at build time

Next inlines `NEXT_PUBLIC_*` into the client bundle when it builds. Since the
build happens on a dev machine, a local `apps/web/.env.local` would otherwise be
compiled into production — which is exactly how the deployed page once ended up
fetching `localhost:4001/api/health`. `deploy.sh` now pins
`NEXT_PUBLIC_API_URL=/api` for the production build; a real environment variable
outranks every `.env` file in Next, so local dev config can no longer leak.
