# Decision 0002: Map as Image Plane

## Status

Proposed

## Decision

Represent the Gen Con map as a static image/canvas plane. Store member and rally-point locations as relative percentage coordinates.

## Context

The Indiana Convention Center is an indoor venue where GPS is unreliable. The product goal is coordination, not precise navigation. The user also identified the official Gen Con map page as the canonical map reference.

## Consequences

- The MVP avoids geographic map APIs.
- Coordinates remain stable across phone sizes and zoom levels.
- The app needs good pan/zoom and tap-coordinate handling.
- A developer must provide the current map image as a Vercel static asset or configured static URL.
