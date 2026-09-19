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

Three things, and an SOS silently reaches nobody until all three are done:

1. **`eas init`** — writes `extra.eas.projectId` into the config. Without it
   `getExpoPushTokenAsync` issues a token against no project and every alert is
   delivered into a void, with no error anywhere. `registerForPush` returns
   `{ ok: false, reason: "no_project_id" }` for exactly this case.
2. **FCM v1 service account** (Android) and an **APNs key** (iOS), uploaded to EAS.
3. **The Expo access token**, if the project has enhanced push security switched on.
   It is read from the database, not the environment, because the thing that sends the
   push is a Postgres function called by pg_cron and there is no process holding an env
   var at that moment:

   ```sh
   pnpm db:sql "select set_secret('expo_access_token', 'YOUR_TOKEN')"
   ```

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
