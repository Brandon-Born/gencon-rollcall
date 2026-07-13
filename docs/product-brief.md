# Product Brief

## Product

**Gen Con Roll Call** is a private, mobile-first POC for one known friend group attending Gen Con Indy 2026, which official Gen Con pages list as July 30-August 2, 2026.

The app helps the group answer:

- Where is everyone roughly?
- Who is available?
- Where should we meet?
- Who is heading to a rally point?

## Non-Negotiable Principle

Design for coordination without surveillance.

The primary location mechanism is manual pin placement on a convention-map image. Optional GPS may help a user place a rough starting point, but the app must not automatically publish continuous location updates.

## Access Model

- One shared group.
- One shared site password.
- Password validation must happen server-side with an environment secret.
- After successful validation, use anonymous Firebase Authentication or an equivalent lightweight authenticated session.
- On first entry, ask only for display name. If it matches an existing member after case and
  whitespace normalization, restore that Firebase member identity instead of creating a duplicate.
- Persist authorization and display name until sign-out or local data clearing.

Do not build group creation, invite links, join codes, multi-tenancy, public discovery, or complex role management for MVP.

## Primary Flow

1. Open site.
2. Enter shared password.
3. Enter display name; rejoin the matching existing member when one exists.
4. See shared convention map.
5. Tap the map to place or move personal pin.
6. Select a status and optional note.
7. Create or respond to rally points.
8. See group updates in near real time.

## Required Statuses

- At an event
- Vendor Hall
- Gaming
- Food / drinks
- Hotel / resting
- Heading somewhere
- Available
- Need a break
- Offline

## Required Rally Responses

- Heading there
- Arrived
- Cannot make it

## MVP Non-Goals

- Private-group creation
- Invite links or join codes
- Full account registration
- Full chat system
- Event schedule import
- Calendar sync
- Public convention maps
- Native iOS or Android apps
- Turn-by-turn navigation
- Continuous background tracking
- Complex role management
- Multiple convention support
- Heavy analytics
