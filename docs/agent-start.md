# Agent Start

Use this file when picking up the project in a new session.

## Current State

- Angular 21 app is scaffolded.
- Mobile route shell exists.
- Prototype screens exist for gate, onboarding, map, people, rally points, and settings.
- Firebase client placeholders, Hosting config, Firestore rules, and Storage rules exist.
- Real backend auth and Firestore data flow are not implemented yet.

## Read First

1. `AGENTS.md`
2. `docs/backlog.md`
3. `docs/product-brief.md`
4. `docs/firebase-security.md`
5. `docs/architecture.md`
6. `docs/design-system.md`

## Start Here

Work the `Next 3` list in `docs/backlog.md`.

Current order:

1. `AUTH-001` Implement server-side shared-password verification.
2. `AUTH-002` Enable anonymous Firebase auth and authorized session persistence.
3. `MAP-001` Load map config and protected Firebase Storage map image.

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
