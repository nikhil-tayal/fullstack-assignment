#!/usr/bin/env bash
#
# deploy.sh — build locally, ship to the DigitalOcean droplet.
#
# The droplet already hosts another site (easysupply.in / easysupply-api on
# :4000) on a 1 vCPU / ~1GB box, so this script is deliberately conservative:
# it never touches nginx sites or pm2 apps it doesn't own, builds happen
# locally (the box is too small to build reliably), and every remote step is
# written to be safe to re-run. Idempotent — safe to run repeatedly.
#
# Usage:
#   ./deploy.sh                                 # build + push + restart
#   CERTBOT_EMAIL=you@example.com ./deploy.sh    # override the certbot contact
#
set -euo pipefail

# ---- config -----------------------------------------------------------------
SSH_HOST="root@64.227.159.81"
APP_DIR="/root/assignment"                 # repo clone on the server
DOMAIN="assignment.nikhiltayal.info"
NGINX_SITE_NAME="assignment"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-vaishalipathak0905@gmail.com}"
SSH_OPTS="-o ConnectTimeout=10"
# -----------------------------------------------------------------------------

# Always operate from the repo root (where this script lives).
cd "$(dirname "$0")"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ---- preflight --------------------------------------------------------------
info "Preflight checks"
for bin in pnpm rsync ssh dig; do
  command -v "$bin" >/dev/null 2>&1 || die "'$bin' is not installed / not on PATH."
done
ssh $SSH_OPTS -o BatchMode=yes "$SSH_HOST" 'true' \
  || die "Cannot SSH into $SSH_HOST (check key/agent and droplet status)."

# ---- DNS preflight ------------------------------------------------------------
# Certbot needs the domain pointed at the box before it can issue a cert. We
# don't want a missing DNS record to block shipping the app though — plain
# HTTP still works — so this only sets a flag the remote block reads later.
info "Checking DNS for $DOMAIN"
RESOLVED_IP="$(dig +short A "$DOMAIN" | tail -n1)"
DNS_OK="false"
if [[ "$RESOLVED_IP" == "64.227.159.81" ]]; then
  DNS_OK="true"
  info "$DOMAIN resolves to 64.227.159.81 — HTTPS will be attempted"
else
  warn "$DOMAIN does not resolve to 64.227.159.81 (got: '${RESOLVED_IP:-<none>}')"
  warn "Add an A record: name 'assignment', value '64.227.159.81'"
  warn "HTTPS (certbot) will be SKIPPED this run — deploying over HTTP only"
fi

# ---- build locally ------------------------------------------------------------
info "Building locally (pnpm -r build)"
pnpm install --frozen-lockfile
# Next inlines NEXT_PUBLIC_* at BUILD time, and this build runs on a dev
# machine — so a developer's apps/web/.env.local (pointing at localhost:4001
# for `pnpm dev`) would otherwise be compiled straight into the production
# bundle. A real environment variable outranks every .env file in Next, so
# pinning it here makes the production build immune to local dev config.
# In production nginx serves both apps from one origin, so "/api" is correct.
NEXT_PUBLIC_API_URL="/api" pnpm -r build
[[ -f apps/api/dist/main.js ]] \
  || die "API build missing: apps/api/dist/main.js"
[[ -f apps/web/.next/standalone/apps/web/server.js ]] \
  || die "Web build missing: apps/web/.next/standalone/apps/web/server.js"

# ---- assemble the web bundle locally ------------------------------------------
# `standalone` only traces the runtime deps + server; static assets and
# public/ are deliberately left out by Next and must be copied in by hand.
info "Assembling web bundle"
WEB_STAGE="$(mktemp -d)"
trap 'rm -rf "$WEB_STAGE"' EXIT

cp -a apps/web/.next/standalone/. "$WEB_STAGE/"
mkdir -p "$WEB_STAGE/apps/web/.next"
cp -a apps/web/.next/static "$WEB_STAGE/apps/web/.next/static"
# public/ is optional — not every app has one, so don't fail if it's missing.
if [[ -d apps/web/public ]]; then
  cp -a apps/web/public "$WEB_STAGE/apps/web/public"
fi

info "Syncing web bundle → $SSH_HOST:$APP_DIR/apps/web/.next/standalone"
ssh $SSH_OPTS "$SSH_HOST" "mkdir -p '$APP_DIR/apps/web/.next/standalone'"
rsync -az --delete -e "ssh $SSH_OPTS" \
  "$WEB_STAGE/" "$SSH_HOST:$APP_DIR/apps/web/.next/standalone/"

# ---- push API -------------------------------------------------------------
info "Syncing API → $SSH_HOST:$APP_DIR"
ssh $SSH_OPTS "$SSH_HOST" "mkdir -p '$APP_DIR/apps/api'"
rsync -az --delete -e "ssh $SSH_OPTS" \
  apps/api/dist/ "$SSH_HOST:$APP_DIR/apps/api/dist/"
# Workspace manifests + PM2 config — needed on the server for `pnpm install
# --prod` (the API is not bundled, unlike web) and for pm2 to pick up.
rsync -az -e "ssh $SSH_OPTS" \
  package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ecosystem.config.cjs \
  "$SSH_HOST:$APP_DIR/"
rsync -az -e "ssh $SSH_OPTS" \
  apps/api/package.json "$SSH_HOST:$APP_DIR/apps/api/package.json"
rsync -az -e "ssh $SSH_OPTS" \
  apps/web/package.json "$SSH_HOST:$APP_DIR/apps/web/package.json"

# ---- remote finish (deps, nginx, pm2, certbot) --------------------------------
info "Configuring + restarting on the server"
# Single-quote each value so the remote shell keeps it intact instead of
# word-splitting/glob-expanding it.
ssh $SSH_OPTS "$SSH_HOST" \
  "APP_DIR='$APP_DIR' DOMAIN='$DOMAIN' NGINX_SITE_NAME='$NGINX_SITE_NAME' CERTBOT_EMAIL='$CERTBOT_EMAIL' DNS_OK='$DNS_OK' bash -seuo pipefail" <<'REMOTE'
say()  { printf '\033[1;34m  ->\033[0m %s\n' "$*"; }
rwarn(){ printf '\033[1;33m  WARN:\033[0m %s\n' "$*"; }

# The API is not bundled (unlike web's standalone output), so its
# node_modules must exist on the server. --prod skips devDependencies to
# keep this light on the small box.
say "pnpm install --prod on server (api only)"
cd "$APP_DIR" && pnpm install --prod --no-frozen-lockfile --filter "@assignment/api..."

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

# nginx site — write only on first run so we never clobber certbot's later
# HTTPS edits, and never touch any other site (e.g. easysupply) living
# alongside this one in sites-available/sites-enabled.
NGINX_SITE="/etc/nginx/sites-available/$NGINX_SITE_NAME"
if [[ ! -f "$NGINX_SITE" ]]; then
  say "Writing nginx site (first run)"
  cat > "$NGINX_SITE" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 25M;

    location /api/ {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
NGINX
  ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE_NAME"
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    say "nginx reloaded"
  else
    rwarn "nginx config test failed — left running config untouched"
    nginx -t || true
  fi
else
  say "nginx site exists — leaving it (preserves any certbot/HTTPS config)"
fi


# PM2: start or hot-reload both apps from the shared ecosystem file.
say "PM2 startOrReload"
pm2 startOrReload "$APP_DIR/ecosystem.config.cjs" --update-env
pm2 save

# Ensure PM2 resurrects on reboot (idempotent).
if ! systemctl is-enabled pm2-root >/dev/null 2>&1; then
  say "Enabling PM2 startup on boot"
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  pm2 save
fi

# certbot — only when DNS actually points here, and only if there's no cert
# yet. A certbot failure warns but never fails the deploy; the HTTP site
# must stay up either way.
if [[ "$DNS_OK" == "true" ]]; then
  if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    say "Certificate for $DOMAIN already exists — skipping certbot"
  else
    say "Requesting certificate for $DOMAIN"
    set +e
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
    if [[ $? -ne 0 ]]; then
      rwarn "certbot failed — site remains on HTTP, re-run deploy.sh once DNS/certbot issues are fixed"
    fi
    set -e
  fi
else
  say "Skipping certbot — DNS for $DOMAIN doesn't point at this box yet"
fi

pm2 ls
REMOTE

# ---- smoke test ---------------------------------------------------------------
if [[ "$DNS_OK" == "true" ]] && ssh $SSH_OPTS "$SSH_HOST" "test -d /etc/letsencrypt/live/$DOMAIN"; then
  PUBLIC_URL="https://$DOMAIN"
else
  PUBLIC_URL="http://$DOMAIN"
fi

info "Smoke-testing $PUBLIC_URL/api/health"
if curl -fsS --max-time 10 "$PUBLIC_URL/api/health"; then
  echo
  info "Health check OK"
else
  warn "Health check did not respond yet — this can be normal right after a fresh deploy (DNS/cert propagation, cold start). Check manually: curl $PUBLIC_URL/api/health"
fi

bold ""
bold "Deployed → $PUBLIC_URL"
