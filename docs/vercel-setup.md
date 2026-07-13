# Vercel Setup

The MVP is hosted on Vercel. Firebase remains the data plane for Authentication and Firestore; Vercel serves the Angular app, static map assets, and the shared-password API route.

## Vercel Runtime

Serverless API route:

```text
api/verify-shared-password.ts
```

Member identity route:

```text
api/member-identity.ts
```

The identity route uses the same Firebase Admin credential as password verification. It requires
an authorized Firebase ID token and owns member creation, case/whitespace-insensitive rejoin,
rename, and leave. A Firestore Admin transaction updates a server-only normalized-name reservation
and member document together. It returns a Firebase custom token when an existing identity is
claimed. No Firebase Cloud Function, paid Firebase plan, or new environment variable is required.

Expected request:

```http
POST /api/verify-shared-password
Content-Type: application/json
Authorization: Bearer <Firebase anonymous auth ID token>

{ "password": "shared site password" }
```

Success response:

```json
{ "ok": true }
```

Failure responses intentionally return short error codes and never echo the submitted password.

On success, the API route writes `authorizedUsers/{uid}` for the UID from the Firebase ID token. This unlocks Firestore reads through the security rules.

## Vercel Environment Variables

Browser notifications also require the public Web Push certificate key from Firebase Console →
Project settings → Cloud Messaging → Web configuration. Copy that public key to
`webPushPublicKey` in the Angular environment files (it is public, not a secret). The existing
Firebase Admin credential in Vercel sends messages through the authenticated API routes; no
messaging private key belongs in the browser.

Required:

```text
SHARED_SITE_PASSWORD
```

Required for Firebase Admin in the API route. Prefer a single JSON value copied from a Firebase service account key:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
```

Alternative split variables if JSON is awkward in Vercel:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

When using `FIREBASE_PRIVATE_KEY`, keep the escaped newline sequences intact or configure it as a multiline secret in Vercel. The API route normalizes `\n` sequences.

Do not put `SHARED_SITE_PASSWORD` or service account values in Angular environment files, Firestore, `.env`, README examples, screenshots, logs, or test fixtures.

## Angular Configuration

Vercel serves the API route from the same origin as the Angular app, so the client uses a relative endpoint:

```text
passwordVerificationUrl: '/api/verify-shared-password'
memberIdentityUrl: '/api/member-identity'
```

The Firebase Web app config in `src/environments/environment.ts` is public client configuration, not a secret.

## Firebase Project State

Created with the Firebase CLI:

```text
Project ID: gencon-rollcall
Project name: Gen Con Roll Call
Console: https://console.firebase.google.com/project/gencon-rollcall/overview
Web app ID: 1:671879050351:web:bc1f69247dbf720342c99a
Firestore location: nam5
Firestore rules: deployed 2026-07-07
Vercel project: brandon-borns-projects/gencon-rollcall
GitHub repo: connected to https://github.com/Brandon-Born/gencon-rollcall
Production URL: https://gencon-rollcall.vercel.app
```

Verified production setup:

- Firebase Anonymous Auth can create anonymous users.
- Vercel production has `SHARED_SITE_PASSWORD`.
- Vercel production has `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Wrong-password API smoke test returns `401 invalid-password`.
- Correct-password production smoke test passed: a password-holder could log in and create a user.
- Official 2026 map cutover completed 2026-07-11: production config defaults to Exhibit Hall,
  legacy synthetic coordinates are cleared, all six maps passed phone QA, and the delete/recreate
  config rollback was exercised successfully.

Firebase Storage is intentionally out of MVP scope now that Vercel is the host. Store the convention map as a Vercel static asset under `public/maps/` or as another static URL configured in Firestore.

## Map Manifest Configuration

The map is a public Vercel asset, but its Firestore configuration is restricted to authorized
users. Use a versioned filename so a PWA that has already cached an older map receives the new
asset instead of reusing the old URL.

1. Review the map source and confirm the image can be used by this private POC. Do not add member
   locations, notes, credentials, or other private data to the image.
2. Add immutable images and a versioned manifest under `public/maps/`; the current official set is:

```text
public/maps/gencon-2026/manifest-v1.json
```

3. Run the local release checks and deploy the app using the production release process below.
4. Confirm the deployed manifest and every image return `200` with the expected content types before changing
   Firestore. A missing static path may fall through to the Angular rewrite, so `200` alone is not
   enough:

```bash
curl --fail --head https://gencon-rollcall.vercel.app/maps/gencon-2026/manifest-v1.json
```

5. In the Firebase console for `gencon-rollcall`, open **Firestore Database** → **Data**. Create or
   update collection `appConfig`, document `current`, with these exact field types:

```text
mapManifestUrl    string     "/maps/gencon-2026/manifest-v1.json"
mapImageUrl       string     <retain the tested legacy fallback during cutover>
mapDisplayName    string     "Gen Con Indy 2026"
updatedAt         timestamp  <current time>
```

6. Sign in as an authorized user and verify the Exhibit Hall default, every selectable map,
   pan/zoom behavior, map-aware pins, and rally deep links. Keep the previous asset in
   `public/maps/` until this check passes; rollback restores the prior config fields.

Follow `docs/official-map-rollout.md` for the required data cleanup and ordered production cutover.

The client cannot write `appConfig/current`; configure it through the Firebase console or an
approved admin tool. If the document or image URL is missing, the app shows an empty map state.

## Firebase Admin Credentials

The Vercel API route needs Firebase Admin credentials to verify ID tokens and write `authorizedUsers/{uid}`.

CLI-created service account:

```text
gencon-rollcall-vercel@gencon-rollcall.iam.gserviceaccount.com
```

Granted role:

```text
roles/datastore.user
```

The local attempt to create a long-lived service-account key and send it to Vercel was blocked by tool approval policy. Prefer a safer credential path if available, or create and add the Firebase Admin credential manually in Vercel with care.

## Local Build

Build the app:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## PWA Verification

Service-worker support is enabled only in production builds. To test the installable app locally,
build it and serve the browser output from localhost over HTTP:

```bash
npm run build
npx http-server dist/gencon-rollcall/browser -p 8080 -c-1
```

Open `http://localhost:8080` in a private browser window. Verify that the web app manifest loads,
the service worker controls the page after registration, and the browser offers installation at a
phone-sized viewport. Production uses HTTPS on Vercel, which satisfies the secure-context
requirement for service workers.

Only the app shell and static assets are cached. Firebase shared state and the password API remain
network-backed; offline writes are not queued or replayed.

## Local Emulator Smoke Tests

Use this path when testing gate, onboarding, map, and member-profile behavior without creating
production Firebase users or Firestore documents. Every local component uses the
`demo-gencon-rollcall` project id; Firebase demo projects have no live resources to fall back to.

Terminal 1:

```bash
npm run emulators
```

This script uses Homebrew OpenJDK at:

```text
/opt/homebrew/opt/openjdk@21
```

Terminal 2:

```bash
npm run dev:emulators
```

This command first seeds `appConfig/current` with `/maps/local-dev-map.svg`, then starts Vercel and
Angular. Open the local URL printed by `vercel dev`. To restore only the map config while the
emulators are already running:

```bash
npm run seed:emulators
```

Local-only shared password:

```text
local-dev-password
```

What this does:

- Angular uses `src/environments/environment.local.ts` with project id `demo-gencon-rollcall`.
- Firebase Auth connects to `127.0.0.1:9099`.
- Firestore connects to `127.0.0.1:8080`.
- The Vercel API route sees `FIREBASE_AUTH_EMULATOR_HOST` and `FIRESTORE_EMULATOR_HOST`, so Firebase Admin writes `authorizedUsers/{uid}` to emulator Firestore without service-account credentials.
- The seed script refuses any non-loopback Firestore host or project id other than
  `demo-gencon-rollcall`.

Verified local emulator smoke test:

- Anonymous Auth creates an emulator user.
- Wrong password returns `401`.
- `local-dev-password` returns `200` from `/api/verify-shared-password`.
- `authorizedUsers/{uid}` is written in emulator Firestore.
- Vercel can create a member and normalized-name reservation after authorization; the authorized
  client can read the member and update non-identity profile fields through Firestore rules.
- `appConfig/current` points to the synthetic local map and the map page is usable immediately.

### Firestore Rules Regression Tests

Run the rules suite without starting emulators manually:

```bash
npm run test:rules
```

`firebase emulators:exec` starts Auth and Firestore for the isolated
`demo-gencon-rollcall-rules` project, runs `tests/firestore.rules.spec.ts`, and shuts the emulators
down. The suite clears Firestore between tests and covers pre-authorization denial, shared reads,
member ownership and deletion policy, admin-only config/authorization records, rally expiration
ownership, response document ownership and field validation, and active/expired parent rallies.

Do not run this command while `npm run emulators` is using the configured ports. Any change to
`firestore.rules` must add or update the relevant regression case before deployment.

## Production Release

Vercel project `brandon-borns-projects/gencon-rollcall` is connected to this repository and tracks
`main` as its production branch. A push to `main` creates a production deployment. The repository's
`vercel.json` supplies these build settings:

- Build command: `npm run build`
- Output directory: `dist/gencon-rollcall/browser`

From the repository root:

1. Confirm the intended release is committed and the tree is clean:

   ```bash
   git status --short --branch
   ```

2. Run all local release checks:

   ```bash
   npm test -- --watch=false
   npm run typecheck:api
   npm run build
   ```

3. If `firestore.rules` changed, deploy the version-controlled rules before the web app that needs
   them:

   ```bash
   firebase deploy --only firestore:rules --project gencon-rollcall
   ```

   CLI deployment overwrites the console rules with `firestore.rules`; do not maintain a separate
   uncommitted ruleset in the Firebase console.

4. Push the verified commit to the production branch:

   ```bash
   git push origin main
   ```

5. In Vercel, wait for the production deployment to finish and confirm it is assigned to
   `https://gencon-rollcall.vercel.app`. If Git deployment is unavailable, an authenticated,
   project-linked checkout can deploy the same source directly:

   ```bash
   npx vercel deploy --prod
   ```

Do not rotate or remove the required environment variables during a normal release; the password
endpoint returns `server-not-configured` when its server configuration is missing.

## Post-Deploy Smoke Test

Use a private phone-sized browser viewport (390px wide) so an existing Firebase or service-worker
session cannot hide a release problem. Record the deployed commit and deployment URL with the
result.

1. Open the production URL over HTTPS. Confirm the gate renders without horizontal overflow and no
   shared map, member, or rally data is visible before authorization.
2. Submit one known-wrong password. Confirm the app stays unauthorized and shows the expected
   invalid-password message without echoing the submitted value.
3. Submit the correct shared password. Confirm an existing member reaches the app, or a fresh
   anonymous user reaches onboarding and can save a display name.
4. Confirm the configured map title and image load. Pan, pinch/zoom, place or move the current
   user's manual pin, and verify its percentage position remains stable.
5. Update status and note. In a second authorized session, confirm the People page receives the
   change without a refresh.
6. Create a rally from the map. In the second session, respond **Heading there**, change the
   response to **Arrived**, and confirm counts update. As the creator, end the rally and confirm it
   disappears from active map/list views without deleting its Firestore history.
7. Hide the first user's location. Confirm their pin disappears while their status and note remain
   visible in People.
8. Open Settings, edit the display name, reload, and confirm it persists. Sign out and confirm the
   gate returns.
9. Check the browser console for relevant errors. Confirm `manifest.webmanifest` and
   `ngsw-worker.js` return `200`, then verify the browser offers installation and the installed app
   opens in standalone mode.
10. If a fresh test member was created only for release verification, use the app's leave flow so
    Vercel removes both the member and normalized-name reservation. Remove test rally history with
    an approved admin tool after recording the result. Do not delete real member or rally history.

If the app shell looks stale after a deployment, reload once to let Angular's service worker detect
the new version, then reload again to use it. A map change still requires a new versioned asset URL.

## Security Notes

- The password endpoint accepts only `POST`; the member identity endpoint accepts `POST` and
  `DELETE`.
- Submitted passwords are not logged.
- Repeated failed attempts are throttled in memory per serverless instance and IP.
- In-memory throttling is a lightweight MVP guard, not a durable abuse-prevention system.
- Anonymous users still cannot read shared app data until the password succeeds and `authorizedUsers/{uid}` exists.
