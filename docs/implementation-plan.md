# Implementation Plan

## Architecture Decisions

- Scaffold Angular 21 as a standalone-component app.
- Use route-level lazy loading for the authenticated app shell and any setup/admin surface.
- Use Angular signals for local UI state and observable-to-signal bridges for Firestore streams.
- Keep Firebase access behind narrow services: auth/session, members, map config, and rally points.
- Represent the map as an image/canvas coordinate plane, not a geographic map.
- Store pins and rally points as relative percentages: `mapXPercent` and `mapYPercent`.

## Password Gate and Session Approach

1. User submits shared password to the Vercel `/api/verify-shared-password` endpoint.
2. Backend compares the submitted value to an environment secret.
3. On success, backend enables the client to establish authorized anonymous Firebase identity.
4. Store authorization server-side using a custom claim or an authorization record tied to the anonymous UID.
5. Firestore rules allow shared data only for authorized UIDs.
6. Client persists Firebase auth session and local display-name cache.
7. Sign-out clears Firebase auth and local session data.

Preferred MVP security path: the client signs in anonymously first, then a Vercel API route validates the password and creates a server-managed `authorizedUsers/{uid}` record.

Current scaffold note: Angular uses the Firebase JavaScript SDK directly. AngularFire stable was still peered to Angular 20 when the scaffold was created; Angular 21 support was only available as an RC. Reconsider AngularFire when a stable Angular 21-compatible release is available.

## Data Model

```text
AppConfig
- mapManifestUrl
- mapImageUrl
- mapDisplayName
- defaultMapId
- maps[]
- updatedAt

Member
- id
- displayName
- nameKey
- avatarStyle
- status
- note
- mapId
- mapXPercent
- mapYPercent
- locationVisible
- lastUpdatedAt
- joinedAt

RallyPoint
- id
- title
- note
- mapId
- mapXPercent
- mapYPercent
- scheduledTime
- createdByMemberId
- createdByName
- status
- expiresAt

RallyResponse
- id
- rallyPointId
- memberId
- responseStatus
- updatedAt

MemberName
- id (SHA-256 of normalized name)
- uid
- nameKey
- displayName
- createdAt
- updatedAt
```

## Core Screens and Routes

- `/gate`: shared password entry.
- `/onboarding`: display name entry for authorized users without a member profile.
- `/app/map`: shared map, personal pin controls, current status, rally markers.
- `/app/people`: group status list with notes and freshness.
- `/app/rallies`: active rally points and responses.
- `/app/settings`: display name, hide location, sign out, optional setup link.
- `/setup`: protected developer/admin setup for map image URL selection, if needed for MVP.

## MVP Milestone Sequence

1. Scaffold Angular 21 + Firebase config placeholders + app shell.
2. Password gate endpoint and anonymous-auth session.
3. Firestore rules and authorized-user security model.
4. Onboarding and member profile persistence.
5. Shared map image loading from config.
6. Mobile map pan/zoom and manual pin placement.
7. Member status, note, freshness display, and hide-location control.
8. People list.
9. Rally point create/respond/expire flow.
10. PWA install support and deployment docs.

## Key Technical Risks

- Firebase custom-claims refresh can be awkward immediately after authorization; an authorization document may be simpler for MVP.
- Indoor GPS will be unreliable and should never be treated as truth.
- Convention map licensing and fidelity need manual review; use the official map page as source reference but store an allowed image copy.
- Mobile map gestures need careful testing to avoid scroll/zoom conflicts.
- Firestore rules must block all shared data before password authorization.

## Assumptions

- This is a private POC for one known group.
- A developer can manually provide the current Gen Con map image.
- Firebase is acceptable for auth and real-time sync. Vercel is the hosting, static map asset, and API runtime.
- The MVP can use anonymous auth rather than user accounts.
- Browser push notifications are out of scope unless later prioritized.
