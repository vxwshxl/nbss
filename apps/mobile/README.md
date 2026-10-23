# NBSS Operations — the app

Expo SDK 57. Guards, supervisors and clients.

## Running it

This app **cannot run in Expo Go**. Background location with an Android foreground
service, a high-importance notification channel, and MapLibre's native renderer are all
native code that Expo Go does not contain. You need a development build:

```sh
pnpm env:link                       # from the repo root, once per clone
cd apps/mobile
npx expo prebuild --clean           # generates ios/ and android/ from app.config.ts
npx expo run:android                # or run:ios
```

`ios/` and `android/` are gitignored on purpose: `app.config.ts` is the single source of
truth for native configuration, and a committed native project becomes the stale second
copy of it.

## Before push notifications work

Pushes leave from the server: `apps/web/scripts/push-worker.mjs` (PM2 `nbss-push` on
okhrang.core) drains `push_outbox` to Expo every two seconds. Check it with
`pm2 logs nbss-push`.

1. **EAS project** — done: `nbss-operations` under the Expo account `vxwshxl`, its
   projectId set in `app.config.ts`. `registerForPush` returns
   `{ ok: false, reason: "no_project_id" }` if that is ever lost.
2. **FCM v1 service account** (Android) and an **APNs key** (iOS), uploaded to EAS
   (`eas credentials`). Until then an SOS reaches nobody on that platform.
3. **The Expo access token**, only if the project turns on enhanced push security: put
   `EXPO_ACCESS_TOKEN=…` in `/srv/nbss/.env` and `pm2 restart nbss-push`.

Builds get the Supabase URL, publishable key and website address from the EAS
environments `preview` and `production` (`eas env:list`), not from `.env`.

Push cannot be tested on a simulator. `registerForPush` returns `reason: "simulator"`
rather than failing, so the rest of the app still works there.

## Where things live

```
src/app/        routes only — every file here is a route
src/screens/    screen bodies the routes render
src/components/ reusable UI
src/lib/        supabase client, auth, location, push, duty and SOS actions
src/theme/      design tokens, converted from the web console's oklch values
```

`src/lib/location-task.ts` is imported for its side effect at the top of
`src/app/_layout.tsx`. That import is load-bearing: the OS wakes this app in the
background with no component tree, so the task has to be registered at module scope or
the position is delivered to a task name that does not exist.

## What decides what

Nothing in this app decides whether a punch is allowed, how far a guard is from a gate,
whether a shift was late, or who an SOS reaches. All of that is in Postgres —
`punch_in`, `punch_out`, `record_position`, `raise_sos` — computed from coordinates the
database stored and a clock it owns. The app sends a coordinate and an accuracy, both of
which a modified app could lie about, and neither of which is trusted.

The one local calculation is `nearbySites`, which colours the check-in button before the
round trip. It mirrors `site_fence_check` exactly (see `@nbss/shared/geo`) and its
verdict is thrown away the moment the server gives its own.
