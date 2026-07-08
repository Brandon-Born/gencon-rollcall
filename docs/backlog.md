# Backlog

This is the project tracker until a dedicated issue tracker exists.

Keep this file practical:

- Update item status when starting or finishing substantive work.
- Add acceptance criteria only where order, security, privacy, or user-visible behavior matters.
- Do not add story points, owners, or process labels unless the project outgrows this file.

Status values:

- `[ ]` not started
- `[/]` in progress
- `[x]` done
- `[!]` blocked

## Next 3

1. `AUTH-001` Finish Vercel/Firebase setup for shared-password verification.
2. `AUTH-002` Finish Firebase setup and live verification for anonymous authorization.
3. `AUTH-003` Persist onboarding display name to Firestore.

Do these in order. Map/member/rally data must not become readable before the authorization path is real.

## Milestone: Foundation

### `FOUND-001` Scaffold Angular app

- [x] Angular 21 standalone app exists.
- [x] Route-level mobile shell exists.
- [x] Main routes exist: `/gate`, `/onboarding`, `/app/map`, `/app/people`, `/app/rallies`, `/app/settings`.
- [x] `npm test` passes.
- [x] `npm run build` passes outside the sandbox.

### `FOUND-002` Establish design and docs

- [x] Product brief exists.
- [x] Architecture docs exist.
- [x] Firebase/security notes exist.
- [x] Initial mobile visual concept exists.
- [x] Design tokens exist in docs and global styles.

### `FOUND-003` Firebase project placeholders

- [x] Firebase client wrapper exists.
- [x] Public Firebase web config exists for `gencon-rollcall`.
- [x] Vercel build config exists.
- [x] Firestore rules starter exists.
- [x] Firebase project values are configured for a real project.

Acceptance criteria:

- No shared password or secret appears in Angular environment files, Firestore, static assets, or docs.
- README names the manual setup still required.

## Milestone: Auth and Session

### `AUTH-001` Server-side shared-password verification

- [x] Choose password verification runtime.
- [ ] Store the expected shared password as an environment secret.
- [x] Add password verification endpoint.
- [x] Avoid logging submitted passwords.
- [x] Add basic failed-attempt throttling or rate-limit note.
- [x] Replace the prototype gate transition with the real verification call.

Depends on:

- `DEC-001` Password verification runtime.

Acceptance criteria:

- Incorrect password does not authorize the browser.
- Correct password authorizes the browser without exposing the password in client code.
- Network/API errors are shown as actionable UI errors.

Implementation status:

- Code exists in `api/verify-shared-password.ts`.
- Angular gate calls `environment.passwordVerificationUrl`.
- The endpoint also authorizes the anonymous UID after password success.
- Vercel project `gencon-rollcall` exists and is connected to the GitHub repo.
- Vercel-specific Firebase service account exists with `roles/datastore.user`.
- Manual Vercel setup still required: set `SHARED_SITE_PASSWORD` and Firebase Admin credentials as Vercel environment variables.

### `AUTH-002` Anonymous auth and authorized session

- [ ] Enable anonymous Firebase auth in the Firebase project.
- [x] Create anonymous Firebase user before password verification to obtain an ID token.
- [x] Create or verify `authorizedUsers/{uid}` server-side after password success.
- [x] Persist authorized sessions across reloads.
- [x] Add sign-out behavior that clears auth and local display-name state.
- [x] Add route guards for authorized and onboarded states.

Depends on:

- `AUTH-001`
- `DEC-002` Authorization document vs custom claim.

Acceptance criteria:

- Reloading the app keeps an authorized user inside the app.
- Signing out returns the user to `/gate`.
- Unauthorized users cannot read app config, members, rally points, or responses.

Implementation status:

- Code exists in `src/app/core/auth/auth-session.ts` and `src/app/core/auth/auth-guards.ts`.
- Firebase Auth persistence is configured for browser-local persistence.
- Server authorization uses `authorizedUsers/{uid}`.
- Firestore rules are deployed to `gencon-rollcall`.
- Firebase Storage is intentionally out of MVP scope; map images should be Vercel static assets.
- Manual Firebase/Vercel setup and live verification still required: enable anonymous auth, configure Vercel env vars, and test against the real Firebase project.

### `AUTH-003` Onboarding persistence

- [x] Prototype display-name flow exists.
- [ ] Persist display name to `members/{uid}`.
- [ ] Reuse existing member profile on return visits.
- [ ] Allow display name edits from Settings.

Depends on:

- `AUTH-002`

Acceptance criteria:

- First authorized entry asks only for display name.
- Returning users are not asked again unless local/auth state is cleared.

## Milestone: Shared Map

### `MAP-001` Map config and static image loading

- [ ] Create `appConfig/current` loading service.
- [ ] Load `mapImageUrl` and `mapDisplayName`.
- [ ] Read map image from a Vercel static asset path or configured static URL.
- [ ] Add empty/loading/error states.
- [ ] Document how a developer adds or configures the current Gen Con map image.

Depends on:

- `AUTH-002`
- `DEC-004` Map setup path.

Acceptance criteria:

- Authorized users can see the configured map.
- The map image is not treated as sensitive; shared app data remains gated by Firestore rules.
- The UI still works when no map is configured.

### `MAP-002` Mobile map pan and zoom

- [ ] Implement pinch zoom.
- [ ] Implement drag pan.
- [ ] Keep controls usable on phone screens.
- [ ] Prevent page scroll conflicts while interacting with the map.
- [ ] Add reset/fit control if needed.

Depends on:

- `MAP-001`

Acceptance criteria:

- A 390px-wide viewport can pan and zoom the map without horizontal page overflow.
- Bottom navigation and status controls remain reachable.

### `MAP-003` Manual pin placement

- [ ] Convert tap/press position to relative percentage coordinates.
- [ ] Save current user's pin to their member document.
- [ ] Render all visible member pins.
- [ ] Show initials, display name, status, and last-updated timestamp.
- [ ] Keep pin coordinates stable across viewport sizes and zoom levels.

Depends on:

- `MAP-001`
- `AUTH-003`

Acceptance criteria:

- A user can place and move their own pin.
- Other authorized users see the update in near real time.
- Pins are stored as percentages, not latitude/longitude.

### `MAP-004` Hide location

- [ ] Add hide-location control.
- [ ] Clear or obscure the user's map coordinates.
- [ ] Keep the user visible in People with status and note.

Depends on:

- `MAP-003`

Acceptance criteria:

- Hidden users have no visible map pin.
- Hidden users remain visible in the people list.

## Milestone: Status and People

### `PEOPLE-001` Member status and note editing

- [ ] Save selected status to Firestore.
- [ ] Save optional note to Firestore.
- [ ] Enforce short note length.
- [ ] Update `lastUpdatedAt` with server timestamp.
- [ ] Show loading/error state for failed saves.

Depends on:

- `AUTH-003`

Acceptance criteria:

- Status options exactly match the product brief.
- Updates appear in the current user's UI immediately and sync to other users.

### `PEOPLE-002` Real-time people list

- [ ] Replace seeded people data with Firestore members stream.
- [ ] Show display name, status, note, and last-updated freshness.
- [ ] Visually distinguish stale/offline updates.
- [ ] Keep list scannable on phone screens.

Depends on:

- `PEOPLE-001`

Acceptance criteria:

- Any authorized user can see the current group state.
- Users with hidden locations still appear.

## Milestone: Rally Points

### `RALLY-001` Create rally points

- [ ] Add rally creation form.
- [ ] Capture title, optional note, optional time, and map coordinates.
- [ ] Save creator id and creator display name.
- [ ] Display rally markers on the map.

Depends on:

- `MAP-003`
- `AUTH-003`

Acceptance criteria:

- Any authorized user can create a rally point from the map.
- Rally points appear to the group in near real time.

### `RALLY-002` Rally responses

- [ ] Add response buttons: Heading there, Arrived, Cannot make it.
- [ ] Store one response per member per rally point.
- [ ] Show response counts.
- [ ] Show the current user's selected response.

Depends on:

- `RALLY-001`
- `DEC-003` Rally responses storage shape.

Acceptance criteria:

- A user can change their response.
- Counts update correctly after response changes.

### `RALLY-003` Rally expiration

- [ ] Support manual expiration.
- [ ] Support scheduled-time based expiration behavior.
- [ ] Hide or de-emphasize expired rally points.

Depends on:

- `RALLY-001`

Acceptance criteria:

- Expired rally points no longer look active on the map.
- Expiration does not delete history unexpectedly.

## Milestone: PWA and Deploy

### `DEPLOY-001` PWA support

- [ ] Add Angular PWA support.
- [ ] Decide offline/resync behavior.
- [ ] Verify installable behavior on a phone browser.

Depends on:

- Core MVP flows working.

### `DEPLOY-002` Deployment docs

- [x] Document Firebase project setup.
- [x] Document required secrets.
- [ ] Document map upload/config process.
- [ ] Document deploy command.
- [ ] Document post-deploy smoke test.

Depends on:

- `AUTH-001`
- `MAP-001`

## Decisions

### `DEC-001` Password verification runtime

- [x] Decide password verification runtime.

Decision: Vercel API route. The app is hosted on Vercel, and a same-origin serverless endpoint keeps the shared password and Firebase Admin credentials out of the client bundle.

### `DEC-002` Authorization model

- [x] Decide authorization document vs Firebase custom claim.

Decision: use `authorizedUsers/{uid}` for MVP because it avoids custom-claim propagation timing.

### `DEC-003` Rally response storage

- [ ] Decide subcollection vs top-level collection.

Recommendation: `rallyPoints/{rallyPointId}/responses/{uid}` for simple rules and reads.

### `DEC-004` Map setup path

- [x] Decide developer-configured URL vs protected upload screen.

Decision: use a developer-configured Vercel static asset or static URL for MVP. Firebase Storage is not worth a billing dependency for a non-sensitive convention map image.

### `DEC-005` Browser notifications

- [ ] Decide whether basic browser notifications are in or after MVP.

Recommendation: after MVP.

## Deferred Explicitly

- [ ] Invite links or join codes.
- [ ] Multiple groups.
- [ ] Full account registration.
- [ ] Full chat.
- [ ] Event schedule import.
- [ ] Calendar sync.
- [ ] Push notifications.
- [ ] Native mobile apps.
- [ ] Turn-by-turn navigation.
- [ ] Continuous location tracking.
