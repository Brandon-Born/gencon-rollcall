# Agent Instructions

Always use the `caveman` skill when it is available in the current Codex session. If that skill is not available, state that limitation briefly and continue with the best available project-specific workflow.

For frontend/product work, use `build-web-apps:frontend-app-builder` when available.

## Project Context

This is a private, mobile-first Angular/Firebase POC named **Gen Con Roll Call**.

Read these files before implementation:

1. `docs/agent-start.md`
2. `docs/backlog.md`
3. `docs/product-brief.md`
4. `docs/implementation-plan.md`
5. `docs/architecture.md`
6. `docs/firebase-security.md`
7. `docs/design-system.md`

## Working Rules

- Preserve the MVP scope. Do not add public social features, multi-group support, group admin, invite links, account registration, full chat, event schedule import, native apps, turn-by-turn navigation, or continuous tracking.
- Prefer simple Angular standalone components and small services over broad abstractions.
- Use manual map pins stored as relative percentage coordinates.
- Keep GPS optional, explicit, and off by default.
- Never put the shared password in client code, Firestore documents, or Storage.
- Document Firebase setup steps instead of hiding required manual configuration.
- Update `docs/backlog.md` when starting or completing substantive work.
- Work the `Next 3` section in `docs/backlog.md` unless the user explicitly redirects priority.

## Verification Expectations

Once an app exists, run the available checks before handoff:

```bash
npm run build
npm run test
```

Also manually verify the phone-sized map flow: password gate, onboarding, map load, pin placement, status update, rally creation, rally response, and hide-location control.
