# Agent Start

Use this file when picking up the project in a new session.

## Current State

- Angular 21 app is scaffolded.
- Mobile route shell exists.
- Prototype screens exist for gate, onboarding, map, people, rally points, and settings.
- Firebase client setup, Vercel API route, and Firestore rules exist.
- Shared-password verification code exists, but Firebase/Vercel production setup still needs live verification.
- Real Firestore app data flow is not implemented yet.

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

1. `AUTH-001` Finish Vercel/Firebase setup for shared-password verification.
2. `AUTH-002` Finish Firebase setup and live verification for anonymous authorization.
3. `AUTH-003` Persist onboarding display name to Firestore.

Do not skip directly to map/member/rally Firestore reads before the authorization path is real.

## Verification

For code changes, run:

```bash
npm test
npm run build
```

Also verify relevant phone-sized flows in a browser. The previous sandbox environment required `npm run build` to run outside the sandbox because the Angular builder aborted before diagnostics there.

## Update Rules

- Update `docs/backlog.md` whenever starting or completing substantive work.
- Add acceptance criteria to backlog items only when they clarify security, privacy, ordering, or user-visible completion.
- Keep docs lean; this project does not need a heavy process.
