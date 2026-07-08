# Decision 0001: Initial Stack

## Status

Accepted

## Decision

Use Angular 21, standalone components, TypeScript, Firebase Authentication, Firestore, Vercel API routes, Vercel static assets, Vercel hosting, and Angular PWA support.

## Context

The product brief explicitly asks for Angular 21 and Firebase. The app needs real-time shared state, lightweight auth, protected shared data, simple hosting, and the project will be hosted on Vercel.

## Consequences

- The MVP can be built without a custom database server.
- Firebase security rules become a core part of the product, not a deployment detail.
- Backend code is still required for password verification because the password cannot live in the client.
- Vercel owns web deploys, static map assets, and the password API route; Firebase owns Auth, Firestore, and security rules.
