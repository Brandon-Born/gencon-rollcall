# Architecture

## Target App Shape

```text
src/
  app/
    core/
      auth/
      firebase/
      models/
      routing/
    features/
      gate/
      onboarding/
      map/
      people/
      rallies/
      settings/
      setup/
    shared/
      ui/
      map-canvas/
      status/
```

## Boundaries

- `core/auth`: password-gate session state, anonymous auth, sign-out.
- `core/firebase`: Firebase initialization and typed collection references.
- `core/models`: shared TypeScript interfaces and converters.
- `features/map`: map viewport, pan/zoom, pin placement, rally markers.
- `features/people`: member list and freshness display.
- `features/rallies`: rally creation, response selection, expiration.
- `features/settings`: display name changes, hide location, sign out.
- `shared/ui`: buttons, sheets, tabs, rows, status indicators.
- `shared/map-canvas`: reusable image-plane coordinate helpers.

## State Strategy

- Use Angular signals for current UI state: selected tab, active sheet, pending pin, form state.
- Use Firestore real-time streams for shared state.
- Convert Firestore streams to readonly signals near feature boundaries.
- Keep optimistic local UI updates small and reversible.

## Map Coordinate Model

The map is a static image plane.

- Pin coordinates are stored as percentages relative to the image bounds.
- Each visible pin and rally point stores one allowlisted `mapId`; only the active map's markers
  render, and records without a map id are treated as legacy synthetic data.
- On render, convert `xPercent` and `yPercent` to CSS pixel positions inside the transformed map layer.
- On tap/press, invert viewport transform and convert the pointer location back to percentages.
- Pin data remains valid if the image renders at different sizes.
- The static manifest supplies the available image planes and explicit default. Only the active
  image is loaded; a configured single-image map remains available as a compatibility fallback.

## Map Interaction Rules

- One-finger drag pans when zoomed.
- Pinch zoom on touch devices.
- Tap or press-and-hold places the current user's pin.
- Explicit confirmation or clear visual affordance should prevent accidental publishing.
- Hide-location removes or obscures `mapXPercent` and `mapYPercent` and sets `locationVisible` false.

## Real-Time Sync

- Members collection streams active member records.
- Rally points stream active rally records. A timed rally uses its scheduled time plus a one-hour
  grace period as `expiresAt`; a no-time rally defaults to four hours. Manually expired or
  time-expired rallies are removed from active streams while their documents remain in Firestore
  history.
- Rally responses can be subcollection documents under each rally point or a top-level collection keyed by `rallyPointId`.
- Use server timestamps for `lastUpdatedAt`, `joinedAt`, `updatedAt`, and expiration fields.

## PWA Notes

- Angular's service worker caches the versioned app shell, icons, and other static assets.
- Map images are cached lazily only after a user loads them; a newly deployed map is fetched when
  its asset URL changes.
- The service worker does not cache Firebase, password API, member, location, rally, or response
  data. Shared state remains network-backed and reconnects through the Firebase SDK.
- Offline mode is intentionally read-limited for MVP: an already-open screen can retain its last
  in-memory view, but fresh shared reads, authorization, and writes require a connection. Failed
  writes continue to use the existing user-visible error states and are not queued for background
  sync.
