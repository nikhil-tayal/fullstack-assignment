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
