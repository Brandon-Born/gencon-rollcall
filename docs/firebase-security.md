# Firebase and Security

## Goals

- The shared password is never present in client JavaScript, Firestore, or Storage.
- Unauthorized users cannot read map config, member records, rally points, or map images.
- Authorized anonymous users can read and write only the limited shared data needed by the app.
- The app collects no unnecessary personal data.

## Recommended MVP Authorization Model

Use a server-side password verification endpoint and an authorization record tied to the Firebase anonymous UID.

Flow:

1. Client creates an anonymous Firebase user to obtain an ID token.
2. Client calls `verifySharedPassword(password)` with that ID token in the `Authorization` header.
3. Backend compares the password to an environment secret.
4. Backend writes `authorizedUsers/{uid}` with `authorized: true`, `authorizedAt`, and `lastVerifiedAt`.
5. Firestore rules check `exists(/databases/$(database)/documents/authorizedUsers/$(request.auth.uid))`.

Creating the anonymous user first does not authorize shared-data access. The user remains blocked by Firestore and Storage rules until the password succeeds and `authorizedUsers/{uid}` exists.

This avoids relying on immediate custom-claims propagation during MVP. Custom claims can replace or supplement the authorization document later.

## Collections

```text
appConfig/current
authorizedUsers/{uid}
members/{uid}
rallyPoints/{rallyPointId}
rallyPoints/{rallyPointId}/responses/{uid}
```

## Storage

Store map images under a protected path such as:

```text
maps/current/*
```

Storage rules should require an authenticated and authorized UID before read access.

## Firestore Rule Intent

- `authorizedUsers`: backend writes only; users may read their own authorization state if necessary.
- `appConfig/current`: authorized users read; setup/admin backend writes.
- `members/{uid}`: authorized users read all; a user writes only their own member document.
- `rallyPoints`: authorized users read and create; creator or expiration process can update status.
- `responses/{uid}`: authorized users read; each user writes only their own response document.

## Password Endpoint

Use Firebase Functions or Cloud Run.

Current decision: use Firebase Functions for MVP. See `docs/firebase-functions-setup.md`.

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
