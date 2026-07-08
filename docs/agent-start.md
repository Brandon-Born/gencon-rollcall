# Agent Start

Use this file when picking up the project in a new session.

## Current State

- Angular 21 app is scaffolded.
- Mobile route shell exists.
- Prototype screens exist for gate, onboarding, map, people, rally points, and settings.
- Firebase client setup, Vercel API route, and Firestore rules exist.
- Production is deployed at `https://gencon-rollcall.vercel.app`.
- Anonymous Auth and wrong-password API behavior are live-verified; correct-password authorization still needs a password-holder smoke test.
- Firestore-backed member onboarding profiles are implemented.
- Local Firebase Auth/Firestore emulator smoke tests work through Vercel dev with `local-dev-password`.

## Read First

1. `AGENTS.md`
2. `docs/backlog.md`
3. `docs/product-brief.md`
4. `docs/firebase-security.md`
5. `docs/architecture.md`
6. `docs/vercel-setup.md`
7. `docs/design-system.md`

## Start Here

Work the `Next 3` list in `docs/backlog.md`.

Current order:

1. `AUTH-001` Smoke-test correct-password authorization with the real shared password.
2. `MAP-001` Load configured static map image.
3. `PEOPLE-001` Persist status and note to Firestore.

Do not skip directly to map/member/rally Firestore reads before the authorization path is real.

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

## Update Rules

- Update `docs/backlog.md` whenever starting or completing substantive work.
- Add acceptance criteria to backlog items only when they clarify security, privacy, ordering, or user-visible completion.
- Keep docs lean; this project does not need a heavy process.
