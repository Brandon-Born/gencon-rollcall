# Firebase and Security

## Goals

- The shared password is never present in client JavaScript or Firestore.
- Unauthorized users cannot read map config, member records, rally points, or responses.
- Authorized anonymous users can read and write only the limited shared data needed by the app.
- The app collects no unnecessary personal data.

## Recommended MVP Authorization Model

Use a server-side password verification endpoint and an authorization record tied to the Firebase anonymous UID.

Flow:

1. Client creates an anonymous Firebase user to obtain an ID token.
2. Client calls `/api/verify-shared-password` with that ID token in the `Authorization` header.
3. Backend compares the password to an environment secret.
4. Backend writes `authorizedUsers/{uid}` with `authorized: true`, `authorizedAt`, and `lastVerifiedAt`.
5. Firestore rules check `exists(/databases/$(database)/documents/authorizedUsers/$(request.auth.uid))`.

Creating the anonymous user first does not authorize shared-data access. The user remains blocked by Firestore rules until the password succeeds and `authorizedUsers/{uid}` exists.

## Display-name identity lifecycle

After shared-password authorization, onboarding exchanges the temporary anonymous identity for an
existing member or creates a new one through Vercel's `/api/member-identity` route:

1. The endpoint verifies the current Firebase ID token and its server-managed authorization record.
2. It normalizes the submitted display name for case and whitespace and hashes that key into a
   server-only `memberNames/{nameHash}` document id.
3. A Firebase Admin transaction either reserves the unused name and creates `members/{uid}`, or
   resolves the existing reservation to one member UID. Concurrent requests cannot create two
   reservations for the same normalized name.
4. For a match, the endpoint authorizes the matched UID and returns a short-lived Firebase custom
   token. The client signs in with it and reads the original member document.
5. Settings rename and leave use the same endpoint so the reservation and member document change
   atomically.

The endpoint never returns the member list or accepts an arbitrary UID. Because this is a private
shared-password app, knowing an existing display name after entering the group password is treated
as sufficient recovery proof. The temporary anonymous authorization remains valid when rejoining
so a dropped custom-token exchange can be retried safely; it has no member document and disappears
from the active member model.

This avoids relying on immediate custom-claims propagation during MVP. Custom claims can replace or supplement the authorization document later.

## Collections

```text
appConfig/current
authorizedUsers/{uid}
members/{uid}
memberNames/{nameHash}
rallyPoints/{rallyPointId}
rallyPoints/{rallyPointId}/responses/{uid}
```

## Map Assets

For MVP, map images are Vercel static assets, for example:

```text
public/maps/gencon-2026.png
```

The map image itself is not treated as sensitive. The app gates access to map config, member locations, statuses, and rally data through Firebase Auth and Firestore rules.

## Firestore Rule Intent

- `authorizedUsers`: backend writes only; users may read their own authorization state if necessary.
- `appConfig/current`: authorized users read; setup/admin backend writes.
- `members/{uid}`: authorized users read all and may update only their own non-identity profile
  fields. Creation, `displayName`/`nameKey` changes, and deletion are server-only through Vercel.
  Visible location writes require an allowlisted `mapId` and 0–100 coordinates; hidden locations
  must clear all three map fields.
- `memberNames/{nameHash}`: denied to all Firebase Web SDK reads and writes; Vercel maintains this
  normalized-name reservation with Firebase Admin.
- `rallyPoints`: authorized users read and create; only the creator can mark an active rally
  expired, and that update can touch only `status` and `expiresAt`. New rallies require an
  allowlisted `mapId` and valid percentage coordinates.
- `responses/{uid}`: authorized users read; each user writes only their own response document
  while the parent rally is active and has not reached `expiresAt`.

## Password Endpoint

Use the Vercel API route in `api/verify-shared-password.ts`.

Current decision: use Vercel serverless functions for MVP because hosting is on Vercel. See `docs/vercel-setup.md`.

Required behavior:

- Read expected password from environment secret.
- Rate-limit or minimally throttle repeated failed attempts.
- Return only success/failure, never the expected password.
- Do not log submitted passwords.

## Privacy Controls

- GPS prompt must be user-triggered.
- GPS result should populate a draft pin or explicit "use this location" action, not auto-publish.
- `locationVisible: false` must hide map coordinates while keeping status visible.
- Notes should have a short max length.
- Avoid analytics until there is a clear private need.

## Local Test Isolation

- Emulator scripts and rules tests use the `demo-gencon-rollcall` project id, never the production
  `gencon-rollcall` id.
- Local seed scripts must require loopback emulator hosts and refuse to run against any other host
  or project id.
- The local map fixture is synthetic and contains no member or production convention data.
- Automated rules tests run through `firebase emulators:exec` with the separate
  `demo-gencon-rollcall-rules` project id and clear only that emulator namespace between cases.

## Push subscriptions

`pushSubscriptions` is denied to all Firebase Web SDK reads and writes. The authenticated
`/api/notification-subscription` route verifies the Firebase ID token and authorization record
before saving or deleting a device token. The authenticated notification route independently
verifies the persisted rally/response and event actor before using Firebase Admin to send; it never
exposes another member's token to a client. `notificationEvents` is server-only deduplication state.
