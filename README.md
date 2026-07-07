# Gen Con Roll Call

Private, mobile-first proof-of-concept web app for a small friend group attending Gen Con Indy 2026.

The app helps the group coordinate without a constant stream of texts: members can share a manual map pin, current status, a short note, and rally-point responses in near real time.

## Current Status

This repository is at project setup stage. No Angular app has been scaffolded yet.

Start with the docs in this order:

1. [Product Brief](docs/product-brief.md)
2. [Implementation Plan](docs/implementation-plan.md)
3. [Architecture](docs/architecture.md)
4. [Firebase and Security](docs/firebase-security.md)
5. [Design System](docs/design-system.md)
6. [Backlog](docs/backlog.md)

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
- Firebase Storage for the map image
- Firebase Functions or Cloud Run for password verification
- Firebase Hosting
- Angular PWA support

## Map Source

Treat [https://www.gencon.com/map](https://www.gencon.com/map) as the canonical source to review for the current official Gen Con map. For MVP implementation, store a static convention-map image in Firebase Storage and render it as an image/canvas surface with relative percentage coordinates.

Do not depend on latitude/longitude, continuous GPS, or live scraping of the Gen Con page for MVP.

## Local Development

The app is not scaffolded yet. Once the Angular workspace exists, add the exact commands here.

Expected shape:

```bash
npm install
npm run start
npm run test
npm run build
```

## Manual Setup Required Later

- Firebase project
- Firebase Web app config
- Anonymous Auth enabled
- Firestore database
- Storage bucket
- Firebase Functions or Cloud Run secret for the shared site password
- Firebase Hosting target
- Production map image uploaded or configured

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
