#!/usr/bin/env bash
# Deploy whatever is on GitHub `main` to okhrang.core. Usage: deploy/deploy.sh
#
# Order is always: commit → push → deploy. The server builds the pushed commit, never local
# files. Production env lives in /srv/nbss/.env on the server and is never copied from here.
set -euo pipefail

HOST="${NBSS_HOST:-root@187.126.117.188}"
DIR="/srv/nbss"
BRANCH="main"
cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ Uncommitted changes — commit and push first." >&2; exit 1
fi
git fetch -q origin "$BRANCH"
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]]; then
  echo "✗ HEAD is not what's on origin/$BRANCH — push first." >&2; exit 1
fi
echo "• Deploying $(git rev-parse --short HEAD)"

ssh "$HOST" bash -se <<REMOTE
set -euo pipefail
cd $DIR
git fetch -q origin $BRANCH
git reset -q --hard origin/$BRANCH
pnpm install --frozen-lockfile --reporter=silent

# Build beside the live site, never over it. Building into the .next the server was
# reading replaced its files underneath it, and every page anyone opened during the
# build failed with "This page did not load". Two build folders take turns: the new
# build goes into the one not serving, and the site switches to it on reload.
WEB=$DIR/apps/web
LIVE=\$(cat \$WEB/.next-active 2>/dev/null || echo .next)
if [ "\$LIVE" = ".next-a" ]; then NEXT=.next-b; else NEXT=.next-a; fi
NEXT_DIST_DIR=\$NEXT NODE_OPTIONS="--max-old-space-size=3072" pnpm build > /tmp/nbss-build.log 2>&1 || { tail -40 /tmp/nbss-build.log; exit 1; }

# Tabs still open on the previous version keep their scripts: its static files are
# carried over (hashed names never clash), and dropped after a week.
if [ -d "\$WEB/\$LIVE/static" ]; then cp -Rnp "\$WEB/\$LIVE/static/." "\$WEB/\$NEXT/static/"; fi
find "\$WEB/\$NEXT/static" -type f -mtime +7 -delete 2>/dev/null || true

echo "\$NEXT" > \$WEB/.next-active
pm2 startOrReload ecosystem.config.cjs --update-env >/dev/null
pm2 save >/dev/null
sleep 3
# A build that does not come up is never left live: back to the one that was serving.
if ! curl -fsS -o /dev/null -w "• Health: %{http_code}\n" http://127.0.0.1:3040/api/health; then
  sleep 5
  if ! curl -fsS -o /dev/null -w "• Health: %{http_code}\n" http://127.0.0.1:3040/api/health; then
    echo "✗ The new build did not answer; switching back to \$LIVE." >&2
    echo "\$LIVE" > \$WEB/.next-active
    pm2 startOrReload ecosystem.config.cjs --update-env >/dev/null
    exit 1
  fi
fi
echo "• Live: \$(git rev-parse --short HEAD) from \$NEXT"
REMOTE
