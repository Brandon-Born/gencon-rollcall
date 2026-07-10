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
- On render, convert `xPercent` and `yPercent` to CSS pixel positions inside the transformed map layer.
- On tap/press, invert viewport transform and convert the pointer location back to percentages.
- Pin data remains valid if the image renders at different sizes.

## Map Interaction Rules

- One-finger drag pans when zoomed.
- Pinch zoom on touch devices.
- Tap or press-and-hold places the current user's pin.
- Explicit confirmation or clear visual affordance should prevent accidental publishing.
- Hide-location removes or obscures `mapXPercent` and `mapYPercent` and sets `locationVisible` false.

## Real-Time Sync

- Members collection streams active member records.
- Rally points stream active rally records. A rally with an optional scheduled time uses that
  time as `expiresAt`; manually expired or time-expired rallies are removed from active streams
  while their documents remain in Firestore history.
- Rally responses can be subcollection documents under each rally point or a top-level collection keyed by `rallyPointId`.
- Use server timestamps for `lastUpdatedAt`, `joinedAt`, `updatedAt`, and expiration fields.

## PWA Notes

- Add Angular PWA support after the core route shell exists.
- Cache app shell assets.
- Do not cache shared Firestore data beyond Firebase SDK behavior for MVP unless offline behavior is explicitly designed.
