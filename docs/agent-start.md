# Agent Start

Use this file when picking up the project in a new session.

## Current State

- Angular 21 app is scaffolded.
- Mobile route shell exists.
- Prototype screens exist for gate, onboarding, map, people, rally points, and settings.
- Firebase client setup, Vercel API route, and Firestore rules exist.
- Production is deployed at `https://gencon-rollcall.vercel.app`.
- Anonymous Auth, wrong-password API behavior, and correct-password login/member creation are live-verified.
- Firestore-backed member onboarding profiles are implemented.
- Local Firebase Auth/Firestore emulator smoke tests work through Vercel dev with `local-dev-password`.
- Rally creation, responses, and manual/scheduled expiration are implemented.
- Production builds include installable PWA metadata and app-shell caching.
- The official 2026 multi-map rollout is live in production. MAP-001 through MAP-003, including
  production cleanup, two-session phone QA, and rollback verification, are complete.
- UX Round 2 (`UX-001` through `UX-014`) is complete, including rally timing/names/map responses,
  member lifecycle and map links, rally awareness, location recovery, phone polish, and wording.

## Read First

1. `AGENTS.md`
2. `docs/backlog.md`
3. `docs/product-brief.md`
4. `docs/firebase-security.md`
5. `docs/architecture.md`
6. `docs/vercel-setup.md`
7. `docs/design-system.md`
8. `docs/official-map-rollout.md`

## Start Here

No actionable release blocker is currently queued. Keep shared map/member/rally data behind the
existing authorization checks and use `docs/official-map-rollout.md` when publishing future map
asset versions.

## Verification

For code changes, run:

```bash
npm test
npm run build
```

Also verify relevant phone-sized flows in a browser. The previous sandbox environment required `npm run build` to run outside the sandbox because the Angular builder aborted before diagnostics there.

For auth/member smoke tests without production Firebase data, run:

```bash
npm run emulators
npm run dev:emulators
```

Use `local-dev-password`.

For Firestore security regression tests, with no manually running emulators:

```bash
npm run test:rules
```

## Update Rules

- Update `docs/backlog.md` whenever starting or completing substantive work.
- After completing a backlog item, commit the completed work and push it to the current branch before moving to the next backlog item.
- Add acceptance criteria to backlog items only when they clarify security, privacy, ordering, or user-visible completion.
- Keep docs lean; this project does not need a heavy process.
