# Google Play listing: NBSS Kokrajhar

Everything the Play Console asks for, in the order it asks. Graphics are rebuilt with
`pnpm store:assets`; the app bundle comes from `npx eas-cli build -p android --profile production`
(run in apps/mobile, gives an .aab).

## App details

- **App name** (30 max): `NBSS Kokrajhar`
- **Package**: `com.nbss.okhrang` (fixed for ever once uploaded)
- **Default language**: English (India), en-IN
- **App or game**: App · **Free**
- **Category**: Business
- **Contact email**: support@nbsskokrajhar.com · **Phone**: +91 70020 71628 · **Website**: https://nbsskokrajhar.com
- **Privacy policy**: https://nbsskokrajhar.com/privacy-policy
- **Account deletion URL**: https://nbsskokrajhar.com/delete-account

**Short description** (80 max, 74 used):

> Duty, attendance, live tracking and SOS for NBSS guards, supervisors and clients.

**Full description**:

> NBSS Kokrajhar is the working app of National Bodo Security Service, for the guards, housekeepers and supervisors who staff our sites and for the clients who engage us.
>
> For guards and housekeepers
> • See your duties for today and the week, with the site on a map
> • Check in and out at your site: the app confirms you are inside the site's boundary
> • Raise an SOS with one press. Everyone on duty at the site, every supervisor and the client are alerted at once, with your location
> • Leave handover notes for the next shift
>
> For supervisors and the office
> • A live map of every site and everyone on duty, updated as they move
> • Tap a guard to see their route so far, battery and last signal, and call them
> • See who is inside, outside or out of signal at a glance
> • Receive SOS alerts that ring even on silent, and respond from the map
>
> For clients
> • See who is on duty at your sites right now
> • Track attendance and hours for the month
> • Book additional services
>
> Location is collected only while a staff member is checked in for a duty, including when the app is closed, and stops at check-out. Accounts for staff are issued by NBSS; clients sign in with Google.

## Graphics

| Asset | File | Spec |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512 PNG, opaque |
| Feature graphic | `feature-1024x500.png` | 1024 × 500 PNG |
| Phone screenshots | to take (see below) | 2–8, 9:16, at least 1080 × 1920 |

Screenshots to take from a phone signed in with a TEST account (no real names or phone
numbers on screen): 1 Duty screen with the site map, 2 Check-in, 3 Live map (supervisor)
with the sheet at half, 4 A guard picked on Live with their route, 5 SOS screen, 6 Client
home. Take them on a 1080 × 2400 phone and upload as they are.

## App content (Policy → App content)

- **Privacy policy**: the URL above.
- **Ads**: No ads.
- **App access**: Restricted. Give Google a TEST guard login and a TEST supervisor login
  (employee code + password), with the note: "Staff accounts are issued by NBSS. Sign in
  with Staff login, then the employee code and password below."
- **Content rating**: questionnaire, category "Utility, productivity, communication or
  other"; answer No to every content question. Expected: Rated for 3+ / Everyone.
- **Target audience**: 18 and over only. Not designed for children.
- **News app**: No. **COVID-19 tracing**: No. **Government app**: No. **Financial features**: None.
- **Health apps**: None.

### Data safety

Data is encrypted in transit: **Yes**. Users can request deletion: **Yes** (the URL above).
Data is not sold and not used for advertising.

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Location · Precise location | Yes | No | Required (staff) | App functionality |
| Location · Approximate location | Yes | No | Required (staff) | App functionality |
| Personal info · Name | Yes | No | Required | App functionality, Account management |
| Personal info · Email address | Yes | No | Required (clients), optional (staff) | Account management |
| Personal info · Phone number | Yes | No | Optional | App functionality |
| Personal info · User IDs (employee code) | Yes | No | Required | Account management |
| Photos · Profile picture (from Google) | Yes | No | Optional | Account management |
| Messages · Other in-app messages (handover notes, SOS notes, assistant questions) | Yes | No | Optional | App functionality |
| App info and performance · Diagnostics (battery level, permission states) | Yes | No | Required (staff) | App functionality |
| Device or other IDs (push token, device ID) | Yes | No | Required | App functionality |

"Shared" means given to a third party for its own use. Maps, push delivery and the
assistant's AI service act on NBSS's behalf (service providers), which Play does not
count as sharing.

### Sensitive permissions (Policy → App content → Sensitive app permissions)

**Background location** (ACCESS_BACKGROUND_LOCATION)
- Feature: "Live duty tracking and SOS for security guards"
- Why it is needed: "Guards are tracked only while checked in for a duty, so supervisors
  can see a site is covered and reach a guard who raises an SOS. Guards keep their phone
  in a pocket with the screen off, so tracking must continue in the background. It stops
  at check-out."
- Video (YouTube, unlisted, 30–60 s): open the app as a TEST guard → the "Location while
  you are on duty" explanation appears → Continue → choose "Allow all the time" → check
  in → lock the phone → show the supervisor's Live map with the dot moving → check out.

**Foreground service type: location** (FOREGROUND_SERVICE_LOCATION)
- Use: "Location tracking during a guard's duty, started by the guard's check-in and
  shown as a persistent notification; stopped at check-out." Same video.

**Ignore battery optimisations** (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
- Google allows this only where background work is the app's core function. If review
  rejects it, remove it from `app.config.ts` permissions: the app then opens the battery
  settings page instead, which still works.

## Release

1. Build: `npx eas-cli build -p android --profile production` in apps/mobile (AAB).
2. Play Console → Create app (name, English, App, Free, declarations).
3. Fill everything under App content above, then Store listing.
4. **Testing.** A *personal* developer account created after Nov 2023 must run a
   **closed test with at least 12 testers for 14 days** before it can apply for
   production. An *organisation* account (with a D-U-N-S number) skips this. Start with
   Internal testing either way: upload the AAB there, add testers' Gmail addresses.
5. Let Google manage the signing key (Play App Signing); the EAS keystore becomes the
   upload key. Sideloaded APKs signed with that keystore will not update over a
   Play-installed copy, so pick one channel per phone.
6. After it is live: Console → App updates, set the Play Store link so the in-app
   "Update available" screen sends people there.
