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
pnpm install --frozen-lockfile --filter @nbss/web... --reporter=silent
NODE_OPTIONS="--max-old-space-size=3072" pnpm build > /tmp/nbss-build.log 2>&1 || { tail -40 /tmp/nbss-build.log; exit 1; }
pm2 startOrReload ecosystem.config.cjs --update-env >/dev/null
pm2 save >/dev/null
sleep 3
curl -fsS -o /dev/null -w "• Health: %{http_code}\n" http://127.0.0.1:3040/api/health
echo "• Live: \$(git rev-parse --short HEAD)"
REMOTE
