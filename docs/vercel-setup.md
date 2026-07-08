# Vercel Setup

The MVP is hosted on Vercel. Firebase remains the data plane for Authentication and Firestore; Vercel serves the Angular app, static map assets, and the shared-password API route.

## Vercel Runtime

Serverless API route:

```text
api/verify-shared-password.ts
```

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
```

Remaining manual Firebase setup:

- Enable Firebase Authentication with the Anonymous provider.

The CLI/API attempt to test anonymous sign-in currently returns `CONFIGURATION_NOT_FOUND`, which means Firebase Authentication still needs to be initialized/enabled for this project.

Firebase Storage is intentionally out of MVP scope now that Vercel is the host. Store the convention map as a Vercel static asset under `public/maps/` or as another static URL configured in Firestore.

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

Vercel build settings:

- Build command: `npm run build`
- Output directory: `dist/gencon-rollcall/browser`

Do not production-deploy until required environment variables are configured, or the password endpoint will return `server-not-configured`.

## Security Notes

- The endpoint accepts only `POST`.
- Submitted passwords are not logged.
- Repeated failed attempts are throttled in memory per serverless instance and IP.
- In-memory throttling is a lightweight MVP guard, not a durable abuse-prevention system.
- Anonymous users still cannot read shared app data until the password succeeds and `authorizedUsers/{uid}` exists.
