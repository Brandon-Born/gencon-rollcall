# Gen Con Roll Call

Private, mobile-first proof-of-concept web app for a small friend group attending Gen Con Indy 2026.

The app helps the group coordinate without a constant stream of texts: members can share a manual map pin, current status, a short note, and rally-point responses in near real time.

## Current Status

Angular 21 has been scaffolded with route-level mobile screens, Firebase client setup, a Vercel API route for shared-password verification, and Firestore-backed onboarding profiles. Map, status, people, and rally data flows are still pending.

Start with the docs in this order:

1. [Agent Start](docs/agent-start.md)
2. [Backlog](docs/backlog.md)
3. [Product Brief](docs/product-brief.md)
4. [Implementation Plan](docs/implementation-plan.md)
5. [Architecture](docs/architecture.md)
6. [Firebase and Security](docs/firebase-security.md)
7. [Vercel Setup](docs/vercel-setup.md)
8. [Design System](docs/design-system.md)

## Product Principles

- Manual location sharing first; optional GPS only as a user-triggered convenience.
- One private group only. No group creation, invite links, join codes, or public discovery.
- Server-side shared-password validation. Never hardcode the password in the client bundle or Firestore.
- Real-time coordination, not continuous surveillance.
- Phone browser first, installable PWA when Angular is in place.

## Expected Stack

- Angular 21
- TypeScript
- Standalone components
- Angular signals where appropriate
- Firebase Authentication with anonymous auth
- Firestore for shared real-time state
- Vercel static assets for the map image
- Vercel API route for password verification
- Vercel hosting
- Angular PWA support

## Map Source

Treat [https://www.gencon.com/map](https://www.gencon.com/map) as the canonical source to review for the current official Gen Con map. For MVP implementation, store a static convention-map image in Vercel public assets and render it as an image/canvas surface with relative percentage coordinates.

Do not depend on latitude/longitude, continuous GPS, or live scraping of the Gen Con page for MVP.

## Local Development

```bash
npm install
npm start
npm run test
npm run build
```

For local smoke tests without touching production Firebase data, use the Firebase emulators:

```bash
npm run emulators
```

This script uses the Homebrew OpenJDK path at `/opt/homebrew/opt/openjdk@21`.

In a second terminal:

```bash
npm run dev:emulators
```

Then open the local Vercel URL and use the local-only shared password:

```text
local-dev-password
```

Verified local emulator smoke coverage:

- Anonymous Auth creates an emulator user.
- Wrong password returns `401`.
- `local-dev-password` writes `authorizedUsers/{uid}` in emulator Firestore.
- An authorized user can write and read `members/{uid}` through Firestore rules.

The app uses the public Firebase Web config in `src/environments/environment.ts`. Do not place the production shared site password or Firebase Admin service account values in Angular environment files.

The production build may need to run outside this Codex sandbox on this machine; the sandboxed builder aborted before diagnostics, while the same `npm run build` completed successfully outside the sandbox.

## Manual Map Setup

Store the reviewed convention map as a Vercel static asset, for example:

```text
public/maps/gencon-2026.png
```

Then create or update Firestore `appConfig/current`:

```text
mapImageUrl: "/maps/gencon-2026.png"
mapDisplayName: "Gen Con Indy 2026"
updatedAt: <server timestamp>
```

The map image is not sensitive, but the Firestore config remains readable only to authorized users.

## Definition of Done for MVP

- A visitor can enter the shared password and gain access.
- Password validation happens securely on the server.
- A new user only needs to provide a display name.
- The app remembers authorized users between visits.
- The shared convention map loads for authorized users.
- A user can manually place and update their pin.
- A user can update their status and note.
- Changes propagate to other authorized users in near real time.
- Users can create and respond to rally points.
- Users can hide their location while remaining visible in the people list.
- Unauthorized visitors cannot read or write shared data.
- The app is usable from a phone browser.
- Setup and deployment instructions are documented.
