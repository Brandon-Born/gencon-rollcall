# Firebase Functions Setup

The MVP uses Firebase Functions for `AUTH-001` shared-password verification.

## Function

Exported HTTPS function:

```text
verifySharedPassword
```

Expected request:

```http
POST /verifySharedPassword
Content-Type: application/json

{ "password": "shared site password" }
```

Success response:

```json
{ "ok": true }
```

Failure responses intentionally return short error codes and never echo the submitted password.

## Secret

The function reads the expected password from the Firebase secret:

```text
SHARED_SITE_PASSWORD
```

Set it with Firebase CLI before deploy:

```bash
firebase functions:secrets:set SHARED_SITE_PASSWORD
```

Do not put this value in Angular environment files, Firestore, Storage, `.env`, README examples, screenshots, logs, or test fixtures.

## Angular Configuration

After deploying the function, set the public endpoint URL in:

```text
src/environments/environment.ts
```

Field:

```ts
passwordVerificationUrl: 'https://.../verifySharedPassword'
```

This URL is public. The password itself remains server-side in `SHARED_SITE_PASSWORD`.

## Local Build

Build the function package:

```bash
npm run build:functions
```

Build the app and functions:

```bash
npm run build:all
```

## Security Notes

- The endpoint accepts only `POST`.
- Submitted passwords are not logged.
- Repeated failed attempts are throttled in memory per function instance and IP.
- In-memory throttling is a lightweight MVP guard, not a durable abuse-prevention system.
- `AUTH-002` must add anonymous Firebase auth and server-managed authorization records before shared app data is exposed.
