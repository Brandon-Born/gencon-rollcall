# Decision 0001: Initial Stack

## Status

Proposed

## Decision

Use Angular 21, standalone components, TypeScript, Firebase Authentication, Firestore, Firebase Storage, Firebase Functions or Cloud Run, Firebase Hosting, and Angular PWA support.

## Context

The product brief explicitly asks for Angular 21 and Firebase. The app needs real-time shared state, lightweight auth, protected shared data, and simple hosting.

## Consequences

- The MVP can be built without a custom database server.
- Firebase security rules become a core part of the product, not a deployment detail.
- Backend code is still required for password verification because the password cannot live in the client.
