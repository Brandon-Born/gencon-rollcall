# Backlog

This is the project tracker until a dedicated issue tracker exists.

Keep this file practical:

- Update item status when starting or finishing substantive work.
- Commit and push after completing each backlog item.
- Add acceptance criteria only where order, security, privacy, or user-visible behavior matters.
- Do not add story points, owners, or process labels unless the project outgrows this file.

Status values:

- `[ ]` not started
- `[/]` in progress
- `[x]` done
- `[!]` blocked

## Next 3

1. `MAP-003` Cut production over to the official maps and complete release QA.
2. No second actionable release blocker is currently queued.
3. No third actionable release blocker is currently queued.

## Milestone: Official Gen Con 2026 map rollout

This milestone blocks sharing the app with the friend group. Follow
`docs/official-map-rollout.md`; the official main Exhibit Hall map must be the default map on every
fresh session. The previous `Next 3` UX items remain queued below and resume after this milestone.

### `MAP-001` Prepare and verify official map assets

- [x] Export the official 2026 main Exhibit Hall map and required convention-center levels at a
      consistent, legible resolution.
- [x] Add optimized, versioned assets and a static manifest under `public/maps/gencon-2026/` with
      `defaultMapId: "exhibit-hall"`.
- [x] Compare recognizable labels, rooms, entrances, booth areas, and orientation against the
      official source; verify deployed asset content types before changing Firestore config.

Implementation status:

- Six immutable lossless WebP assets cover the detailed Exhibit Hall plus Basement and convention
  Levels 1–4. The Exhibit Hall includes the official convention-27 area overlay and all 694
  numbered exhibitor areas; level exports include their official floor-specific overlays.
- `manifest-v1.json` explicitly defaults to `exhibit-hall` and records stable ids, dimensions,
  source version/floor/zoom, capture time, and SHA-256 digests.
- Visual comparison confirmed the official hall/booth layout, concourses, ICC, and Lucas Oil
  Stadium orientation. Production returns `application/json` for the manifest and `image/webp` for
  all six images, whose downloaded hashes match the manifest.

### `MAP-002` Add map selection and map-aware locations

- [x] Load and validate the map manifest with a legacy single-image fallback; add a compact map
      selector that defaults to Exhibit Hall and initially loads only the active image.
- [x] Store `mapId` with visible member pins and rally points, filter markers by active map, and
      make People/rally deep links open the target's map before selecting it.
- [x] Update models, writes, Firestore rules, emulator seeds, and focused unit/rule coverage for
      valid map ids, hidden locations, and legacy records.

Implementation status:

- The config service validates the versioned static manifest, safely falls back to a named legacy
  image, selects `exhibit-hall` by default, and renders only the selected image behind a compact
  phone-sized selector.
- Member pins and rally points now persist an allowlisted `mapId`; map markers are filtered by the
  active map, legacy locations are treated as hidden, and legacy rallies are excluded from active
  views.
- People and Rally Points links include the target map and browser QA at 430×844 confirmed each
  link switches maps before centering/selecting its target. Pin/rally create, marker isolation,
  hide, and cleanup flows passed with no horizontal overflow.
- Focused manifest unit tests and emulator rules tests cover defaults, malformed manifests, valid
  map ids, cleared hidden locations, legacy records, and rejected arbitrary/out-of-range writes.

### `MAP-003` Cut over production and complete release QA

- [ ] Deploy compatible assets, client code, and Firestore rules before changing production map
      config.
- [ ] Hide/reset synthetic-map member locations and end/remove synthetic test rallies before
      pointing `appConfig/current` at the official manifest.
- [ ] Verify the complete authorized phone flow at 430×844 with two users, confirm Exhibit Hall is
      the fresh-session default, run all automated gates, and retain a tested config rollback.

## Milestone: UX Round 4 (2026-07-10 lifecycle review)

A third usability pass focused on flows earlier rounds had not exercised end to end. Everything
verified works: wrong password shows "That password did not work.", a wiped/stale session bounces
cleanly to the gate, onboarding disables entry until a name exists, the full rally lifecycle
(create with note and future time → respond → creator End rally → empty state) behaves, the note
save flow shows the counter and flips freshness to "just now" only after saving, and the console
stays clean across a full reload. All five Round 3 fixes were re-verified live: out-of-image taps
are ignored, map response actions stack as readable pills at 430 px, the active count excludes a
9-hour-stale member ("2/3 active"), first placement says "Pin placed." with the undo chip expiring
after 10 seconds, and People rows use the compact chevron. New findings below.

### `UX-020` End rally has no confirmation

- [x] "End rally" ends the rally for the whole group on a single tap with no confirm and no
      undo. Leave app (a less social action) requires confirmation. Add the same lightweight
      confirm step, or a brief undo window like pin moves have.

Implementation status:

- A creator's first tap now opens an inline warning that the rally will leave the active map and
  list for everyone; only the explicit “End for everyone” action performs the write.
- “Keep rally” closes the warning without changing the rally. Browser QA exercised cancel and
  confirmed end paths with no relevant console errors.

### `UX-021` Rally title silently stops at 48 characters

- [x] Typing past the title limit drops characters mid-word with no feedback ("...for the
      whole cre"). The note field next to it shows "120/120". Add the same counter to the
      title field so truncation is visible before the rally is broadcast.

Implementation status:

- The title label now shows a live `0/48` counter using the same treatment as the note counter.
- The sheet contains long titles at phone width so the `48/48` limit remains visible without
  horizontal page overflow; browser QA at 430×844 confirmed both states.

### `UX-022` Rally card action spacing

- [x] "View on map" and the "End rally" button nearly touch on the creator's rally card
      (~1 px gap at desktop width). Add gap so the destructive action is not adjacent to a
      navigation tap target.

Implementation status:

- Rally navigation and creator actions now share an explicit wrapping action row with a 12 px
  horizontal gap; the confirmation panel expands onto its own row.
- Browser QA measured the 12 px gap at 430×844 and 1280×720 and found no relevant console errors.

## Milestone: UX Round 3 (2026-07-10 verification review)

A second usability pass after the UX Round 2 fixes landed. All fourteen Round 2 items were
re-verified in the browser against the local emulator stack and behave as documented: grace
period + "Meeting now", response names, map-card responses with note, leave confirmation,
pin undo, member note on pin card, People→map links with "(You)", tab badge, re-share path,
default lifetimes, stale pin styling, "View on map" links, phone-width layout, and the
wording items. `npm test` (7), `npm run test:rules` (7), and `npm run build` all pass, and
the repaired `npm run dev:emulators` path serves the app and seeds the map out of the box.
The items below are new findings from this round, ordered by impact.

### `UX-015` Taps outside the map image still move the pin

- [x] `mapPercentFromViewportPoint` clamps out-of-bounds taps to 0–100 instead of ignoring
      them, so a tap in the letterbox band beside/above the image snaps the user's pin to
      the image edge (observed live: pin jumped from Hall A to the far left edge). Return
      `null` when the tapped content point is outside the image bounds.
- [x] The same conversion feeds rally spot selection, so a stray band tap also selects an
      edge rally spot. Same fix covers both.

Why: at desktop widths (and any aspect-ratio mismatch) the letterbox bands are large tap
targets that silently broadcast a wrong location; the accidental-move protection from
`UX-005` (undo) softens this but should not be the only line of defense.

Implementation status:

- The shared coordinate conversion returns `null` for points outside the rendered image bounds
  while preserving valid taps exactly on its edges.
- Unit coverage checks all four surrounding bands. Desktop browser QA with 66.5 px side bands
  confirmed an outside tap creates neither a member pin nor rally draft marker, while an inside tap
  still creates each normally.

### `UX-016` Map rally-card response buttons wrap badly at phone width

- [x] On the map rally detail card at ~430 px, "Heading there" wraps to two lines and
      "Cannot make it" to three, the circular buttons crowd into each other, and the
      selected state clips the label. Restyle to match the rally list's compact pill
      buttons (or stack them) so all three labels render whole.

Implementation status:

- The map card now gives its response controls scoped button styles that cannot be overwritten by
  the generic close-button rule. At phone widths the three actions stack as full-width 40 px pills;
  wider layouts retain the three-column row.
- Browser QA at 430×844 confirmed every label stays on one line with no horizontal overflow, and
  the selected “Cannot make it” state remains unclipped.

### `UX-017` People "active" count ignores freshness

- [x] The "3/3 active" chip counts a member whose last update is 8 hours old (and whose row
      is styled stale) as active. Count only members under the stale threshold, or rename
      the chip so it does not overpromise ("3 members").

Implementation status:

- The summary reuses each row's existing stale/offline state and counts only fresh, non-offline
  members as active, with focused unit coverage for fresh, stale, offline, and empty groups.
- Browser QA with one fresh member, one nine-hour-stale member, and one fresh offline member showed
  “1/3 active” while preserving the corresponding row treatments.

### `UX-018` Pin hint and undo lifecycle polish

- [x] First-ever placement says "Pin moved." — say "Pin placed." when there was no prior
      pin.
- [x] The undo chip never expires and persists into other map modes: entering the rally
      flow shows "Tap the map to choose a rally spot. Undo", where Undo still reverts the
      member pin. Clear (or time out) the undo affordance when leaving pin context or after
      ~10 seconds.

Implementation status:

- A first shared location now confirms “Pin placed.” while later relocations retain “Pin moved.”
- Undo expires after 10 seconds and is cleared immediately when the member enters rally creation;
  browser QA verified both transitions and found no console warnings or errors.

### `UX-019` People row map-link affordance is repetitive

- [x] Every visible-location row prints "Tap to view on map". Replace the repeated sentence
      with a compact affordance (chevron or map glyph) once the pattern is established.

Implementation status:

- Rows with a shared map location now use a compact blue chevron while preserving the entire row
  as the keyboard- and tap-activated map link.
- Browser QA at 430×844 confirmed the repeated sentence is absent, the chevron remains visually
  aligned, and activating the row opens the map with that member selected.

## Milestone: UX Round 2 (2026-07-09 adversarial review)

Findings from using the deployed flows as multiple users. Ordered by how much each hurts the
core job: "say where we are and meet up easily."

### `UX-001` Rally expiration timing is wrong for meetups

- [x] Keep a rally visible past its scheduled time with a grace period (suggest 60 minutes)
      instead of hiding it at the exact minute the group is supposed to be meeting.
- [x] Label it "Meeting now" (or similar) between scheduled time and expiry.
- [x] Block or warn on past scheduled times in the rally form (`min` on the
      `datetime-local` input plus a validation message). Today a past time saves
      successfully, shows "Rally point created.", and the rally never appears anywhere.

Why: `expiresAt` is set to `scheduledTime`, so a "Dinner at 6:00" rally vanishes at 6:00 —
exactly when people are standing around looking for each other.

Implementation status:

- Timed rallies expire 60 minutes after their meetup time and show "Meeting now" during the grace
  period on both the map and rally list.
- The rally form sets a rolling local minimum, disables submission for past values, and the data
  service rejects past scheduled times as a second validation layer.

### `UX-002` Rally responses show counts but not names

- [x] Show who responded under each rally ("Heading: Alice, Brandon · Can't: Carl"),
      not just "2 heading there".
- [x] Response docs already store `memberId`; join against the members stream for names.

Why: in an 8-person friend group, "who is coming" is the entire question. A count answers
"how many", which nobody asked.

Implementation status:

- The rally list joins live responses to the live member stream and groups alphabetized names under
  Heading, Arrived, and Can't while retaining the compact counts.
- Responses whose member record no longer exists remain visible as "Former member" instead of
  silently disappearing from the meetup picture.

### `UX-003` Respond to a rally from the map

- [x] Add the three response buttons (and live counts/names) to the rally detail card on
      the map.
- [x] Show the rally note on the map detail card (it is stored and shown in the list, but
      the map card only shows creator and time).

Why: the natural flow is see marker → tap it → say "heading there". Today the map card is
read-only, so the user must switch tabs and find the same rally again in a list.

Implementation status:

- Selecting a rally marker opens a scroll-safe map card with its note, three response actions,
  selected response, live counts, and responder names.
- The map subscribes only to responses for active rallies, cleans up removed-rally subscriptions,
  and saves through the existing authorized response path.

### `UX-004` Leaving the app strands a ghost member

- [x] Add a confirmation step to "Leave app" that explains the consequence (anonymous
      identity is lost; a new entry is created on return).
- [x] Delete or tombstone `members/{uid}` on leave, or add a way to remove departed
      members, so the People list and map do not accumulate stale ghosts.

Why: `leaveApp()` only signs out; the member doc lives forever. After a couple of
re-installs during the con the group list fills with dead "Brandon Born" entries nobody
can remove, each showing a stale status.

Implementation status:

- Leave app now requires an explicit confirmation that explains the anonymous identity reset.
- Confirming leave deletes the current user's member document before sign-out; a failed deletion
  keeps the session active and shows a retryable error.
- Firestore rules allow only an authorized member to delete their own member document, with
  emulator regression coverage for allowed self-deletion and denied cross-member deletion.

### `UX-005` Accidental pin moves

- [x] Tapping the map instantly relocates your pin with no confirmation or undo. Add a
      brief undo affordance ("Pin moved — Undo") in the existing hint pill, or require a
      confirm tap on a provisional marker.

Why: browsing the map is the main activity; one stray tap silently tells the whole group
you are somewhere you are not.

Implementation status:

- After a pin placement or move, the map hint shows a one-tap Undo action that restores the prior
  coordinates; placing a first pin can be undone back to a hidden location.
- Undo uses the same explicit member-location writes and remains available after a failed restore
  so the user can retry.

### `UX-006` Member note is missing from the map pin card

- [x] Show the member note on the pin detail card, not only in People.

Why: the note carries the actually useful location detail ("Booth 2110", "back of hall C").
The pin answers "roughly where"; the note answers "where exactly" — they belong together.

Implementation status:

- The selected member-pin card shows the member's note between status and freshness when a note is
  present, using the same live member data as the pin.

### `UX-007` People rows should link to the map

- [x] Tapping a person in People (when their location is visible) opens the map with their
      pin selected/centered.
- [x] Mark the current user's own row ("You") in People.

Implementation status:

- People rows with a shared pin are keyboard- and tap-activated links to the map; the map selects
  and centers the requested member at a useful zoom after both member data and the image load.
- The signed-in member's row includes a visible “(You)” label.

### `UX-008` New-rally awareness

- [x] Surface that a new rally exists when the user is not looking at the map: a badge on
      the Rally Points tab and/or a transient in-app banner.
- [x] Revisit `DEC-005` (browser notifications) after the badge exists.

Why: a rally is a time-sensitive broadcast; today a friend must happen to glance at the
map to notice one appeared.

Implementation status:

- The Rally Points tab shows a numeric badge for active rally IDs not previously seen on Map or
  Rally Points, including rallies created between sessions through a small local ID snapshot.
- Opening Map or Rally Points marks active rallies seen. Browser notifications remain after MVP;
  the private POC avoids permission prompts and push infrastructure while the in-app badge is the
  primary awareness mechanism.

### `UX-009` Location sharing asymmetry

- [x] Settings can hide the pin but cannot re-share it; re-sharing requires knowing the
      hidden "tap the map" behavior. Add a "Share my location again" path from Settings
      (jump to map with a one-line instruction is enough).

Implementation status:

- When location is hidden, Settings offers “Share my location again,” opens the map, and shows an
  explicit instruction to tap the location to publish a new pin.

### `UX-010` Stale rallies without a time linger forever

- [x] Rallies with no scheduled time never auto-expire, and only the creator can end one.
      Give no-time rallies a default lifetime (suggest 4 hours) and/or let any member end
      a rally in this trusted group.

Implementation status:

- Newly created no-time rallies receive a four-hour `expiresAt`; timed rallies retain the
  scheduled-time-plus-one-hour behavior. The form explains both lifetimes.

### `UX-011` Map pins do not show staleness

- [x] People styles stale/offline members, but map pins render a 6-hour-old pin exactly
      like a fresh one. Dim or desaturate pins past the same stale threshold, and hide or
      gray pins for offline members.

Implementation status:

- Map pins use the People list's one-hour stale threshold: stale pins are dimmed/desaturated and
  offline pins are de-emphasized further. Accessible pin labels announce recent, stale, or offline
  location state in text.

### `UX-012` Replace raw coordinates in rally UI

- [x] Rally list shows "Map spot 84.7%, 33.9%" and the rally form shows "Rally spot
      selected at 84.7%, 33.9%." — internal numbers with no user meaning. Replace with a
      "View on map" link (list) and a plain "Spot selected ✓" (form).

Implementation status:

- Rally cards now show a “View on map” link that opens, selects, and centers the marker; the create
  form confirms only “Spot selected ✓” and no longer exposes percentage coordinates.

### `UX-013` Phone-width map/header polish

- [x] "Indiana Convention Center" wraps to three lines at 390px and squeezes the header
      buttons; use a smaller single-line title treatment.
- [x] The zoom control pill covers a large part of the small map viewport; shrink it or
      move it off the map surface.
- [x] The fixed-height map frame shows large empty grid bands when the image aspect ratio
      does not match; fit the initial view to the image instead.
- [x] The horizontally scrolling status chips clip mid-word with no scroll affordance; add
      an edge fade or wrap to two rows.

Implementation status:

- At 390 px, the map title is a compact single-line ellipsis treatment and the two header actions
  remain usable; zoom controls are 138×46 px instead of dominating the map.
- Once the map image loads, the phone frame follows its aspect ratio within practical height bounds
  instead of forcing a fixed viewport with large contain bands.
- Status options use a two-row horizontal rail with faded edges. Browser QA at 390×844 confirmed no
  horizontal page overflow, a single-line title, the compact controls, and working 100%→125% zoom.

### `UX-014` Wording and small polish

- [x] Rally response heading "How are you getting there?" asks about transport but the
      answers are attendance; change to "Are you going?".
- [x] Add a show-password toggle on the gate (shared password on a phone keyboard).
- [x] Status sheet shows "Updated just now" on first load even when the loaded status is
      hours old; show real freshness or nothing.
- [x] Two members with the same initials get identical map pins; add a per-member color or
      show the first name under the pin.

Implementation status:

- Rally response copy now asks “Are you going?” on the list; the map response group uses the same
  accessible wording.
- The gate has an accessible show/hide password control that changes the input type without
  changing or storing the value.
- Status metadata uses the loaded member's real `lastUpdatedAt` freshness and changes to “just now”
  only after a successful save.
- Member `avatarStyle` deterministically selects one of eight pin fill colors, so shared initials
  remain distinguishable while the status border retains its semantic color.

### `TOOL-001` Local dev smoke path is broken

- [x] `npm run dev:emulators` (vercel dev) currently serves `index.html` for `/main.js`
      because the catch-all rewrite in `vercel.json` is applied to dev asset requests, so
      Angular never bootstraps (blank page). Workaround used during this review:
      `ng serve --configuration local` plus a proxy for `/api`. Fix the rewrite for dev
      (e.g. scope the SPA rewrite away from asset paths) or document the ng-serve+proxy
      path as the supported local flow.
- [x] There is no local seed for `appConfig/current` or a local map asset; document or
      script the emulator seeding step so the map page is testable out of the box.

Implementation status:

- Vercel SPA rewrites are scoped to `/gate`, `/onboarding`, and `/app/*`, so dev JavaScript, Vite,
  map, manifest, and service-worker assets reach Angular instead of being rewritten to HTML.
- All local components use the no-live-resources `demo-gencon-rollcall` project id.
- `npm run dev:emulators` seeds `appConfig/current` with the synthetic
  `/maps/local-dev-map.svg` fixture before starting Vercel and Angular; the seed refuses non-loopback
  hosts and any other project id.
- Browser QA covered the 390px gate → local password → onboarding → seeded map flow with the map
  image loaded, no horizontal overflow, and clean console logs.

### `TOOL-002` Automated Firestore rules regression tests

- [x] Add an emulator-backed Firestore rules test suite and a documented npm command to run it.
- [x] Prove unauthorized users cannot read or write app config, members, rally points, or
      responses.
- [x] Prove authorized users can read shared data but can write only their own permitted member
      and response data.
- [x] Cover response status validation, active/expired parent rallies, creator-only expiration,
      and the allowed expiration fields.
- [x] Add or update member lifecycle coverage when `UX-004` defines tombstone/delete behavior.
- [x] Use deterministic emulator setup and cleanup with an isolated project id; the suite must
      never connect to production Firebase.

Implementation status:

- `npm run test:rules` owns the Auth/Firestore emulator lifecycle through
  `firebase emulators:exec` and runs only against `demo-gencon-rollcall-rules`.
- Seven regression cases cover pre-authorization denial, shared reads, self-owned member writes
  and deletion, admin-only config/authorization records, creator-only rally
  expiration fields, response ownership/status/shape, and active versus expired parent rallies.
- Tests seed admin-only state with Firebase's emulator `owner` token, clear the emulator between
  cases, and require no production credentials or additional test dependency.
- The suite passes independently of the browser smoke flow and is documented in the README and
  setup/security guides.

Acceptance criteria:

- Any change to `firestore.rules` is accompanied by relevant regression coverage.
- The rules suite fails on an authorization or ownership regression and runs independently of the
  browser smoke flow.

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
- [x] Store the expected shared password as an environment secret.
- [x] Add password verification endpoint.
- [x] Avoid logging submitted passwords.
- [x] Add basic failed-attempt throttling or rate-limit note.
- [x] Replace the prototype gate transition with the real verification call.
- [x] Add local emulator smoke path for correct-password authorization.
- [x] Live-test correct shared password against production.

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
- Production Vercel env vars exist for `SHARED_SITE_PASSWORD` and `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Production deploy exists at `https://gencon-rollcall.vercel.app`.
- Wrong-password smoke test returns `401 invalid-password`, confirming the API route and server config are live.
- Local emulator smoke test verifies correct-password authorization writes `authorizedUsers/{uid}` without touching production Firebase.
- Correct-password production smoke test passed: a password-holder could log in and create a user.

### `AUTH-002` Anonymous auth and authorized session

- [x] Enable anonymous Firebase auth in the Firebase project.
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
- Anonymous Auth live smoke test can create an anonymous ID token.
- Correct-password live smoke test confirms guarded navigation and member creation work in production.

### `AUTH-003` Onboarding persistence

- [x] Prototype display-name flow exists.
- [x] Persist display name to `members/{uid}`.
- [x] Reuse existing member profile on return visits.
- [x] Allow display name edits from Settings.

Depends on:

- `AUTH-002`

Acceptance criteria:

- First authorized entry asks only for display name.
- Returning users are not asked again unless local/auth state is cleared.

Implementation status:

- Code exists in `src/app/core/members/member-profile.ts`, `src/app/features/onboarding/onboarding.ts`, `src/app/features/settings/settings-page.ts`, and `src/app/core/auth/auth-guards.ts`.
- Route guards read `members/{uid}` before entering `/app`, so local display-name state does not bypass onboarding.
- Onboarding creates the current user's member profile with default status, visibility, note, pin, and timestamps.
- Settings saves display-name edits back to the current user's member profile.

## Milestone: Shared Map

### `MAP-001` Map config and static image loading

- [x] Create `appConfig/current` loading service.
- [x] Load `mapImageUrl` and `mapDisplayName`.
- [x] Read map image from a Vercel static asset path or configured static URL.
- [x] Add empty/loading/error states.
- [x] Document how a developer adds or configures the current Gen Con map image.

Implementation status:

- Code exists in `src/app/core/app-config/app-config.ts` and `src/app/features/map/map-page.ts`.
- The map page reads `appConfig/current`, uses `mapDisplayName` as the page title, and renders `mapImageUrl` as the image plane when configured.
- Missing config, Firestore load failures, and image load failures have distinct user-visible states.
- Developer setup steps are documented in `README.md` and `docs/vercel-setup.md`.

Depends on:

- `AUTH-002`
- `DEC-004` Map setup path.

Acceptance criteria:

- Authorized users can see the configured map.
- The map image is not treated as sensitive; shared app data remains gated by Firestore rules.
- The UI still works when no map is configured.

### `MAP-002` Mobile map pan and zoom

- [x] Implement pinch zoom.
- [x] Implement drag pan.
- [x] Keep controls usable on phone screens.
- [x] Prevent page scroll conflicts while interacting with the map.
- [x] Add reset/fit control if needed.

Implementation status:

- Code exists in `src/app/features/map/map-page.ts`.
- The map image is rendered inside a touch-isolated viewport with pinch, drag pan, wheel zoom, zoom buttons, and Fit/Reset behavior.
- The transformed map layer is clamped to the viewport and pins keep a stable visual size while zooming.
- Browser QA covered a 390px-wide viewport with emulator-backed gate/onboarding/map flow, no horizontal overflow, reachable status sheet and bottom nav, drag pan, reset, and CDP touch pinch.

Depends on:

- `MAP-001`

Acceptance criteria:

- A 390px-wide viewport can pan and zoom the map without horizontal page overflow.
- Bottom navigation and status controls remain reachable.

### `MAP-003` Manual pin placement

- [x] Convert tap/press position to relative percentage coordinates.
- [x] Save current user's pin to their member document.
- [x] Render all visible member pins.
- [x] Show initials, display name, status, and last-updated timestamp.
- [x] Keep pin coordinates stable across viewport sizes and zoom levels.

Implementation status:

- Code exists in `src/app/core/members/member-profile.ts` and `src/app/features/map/map-page.ts`.
- The map page subscribes to Firestore members in real time and renders pins for members with `locationVisible: true` and saved `mapXPercent`/`mapYPercent` values.
- Tapping the configured map image writes the current user's pin as image-relative percentage coordinates and updates `lastUpdatedAt`.
- Pin detail shows initials, display name, status, and freshness, and pins keep stable visual size while pan/zoom transforms change.
- Browser QA covered a 390px-wide emulator-backed map flow with tap-to-place, Firestore percentage persistence, live second-member pin rendering without refresh, selected marker details, and zoomed pin stability.

Depends on:

- `MAP-001`
- `AUTH-003`

Acceptance criteria:

- A user can place and move their own pin.
- Other authorized users see the update in near real time.
- Pins are stored as percentages, not latitude/longitude.

### `MAP-004` Hide location

- [x] Add hide-location control.
- [x] Clear or obscure the user's map coordinates.
- [x] Keep the user visible in People with status and note.

Implementation status:

- Code exists in `src/app/core/members/member-profile.ts`, `src/app/features/map/map-page.ts`, and `src/app/features/settings/settings-page.ts`.
- The map and Settings surfaces can hide the current user's location by setting `locationVisible: false` and clearing `mapXPercent`/`mapYPercent`.
- Placing a new map pin shares location again through the existing pin-save path.
- Browser QA covered a 390px-wide emulator-backed gate/onboarding/map flow with pin placement, hide-location, hidden pin removal, Settings hidden state, and People visibility with status plus hidden-location label.

Depends on:

- `MAP-003`

Acceptance criteria:

- Hidden users have no visible map pin.
- Hidden users remain visible in the people list.

## Milestone: Status and People

### `PEOPLE-001` Member status and note editing

- [x] Save selected status to Firestore.
- [x] Save optional note to Firestore.
- [x] Enforce short note length.
- [x] Update `lastUpdatedAt` with server timestamp.
- [x] Show loading/error state for failed saves.

Implementation status:

- Code exists in `src/app/core/members/member-profile.ts` and `src/app/features/map/map-page.ts`.
- The map status sheet loads the current user's saved status and note, tracks unsaved changes, and writes updates to `members/{uid}`.
- Saves update `lastUpdatedAt` with a Firestore server timestamp.
- Notes are limited to 80 characters in the UI and normalized again before saving.
- The sheet shows loading, saving, unsaved, success, and retry/error states.

Depends on:

- `AUTH-003`

Acceptance criteria:

- Status options exactly match the product brief.
- Updates appear in the current user's UI immediately and sync to other users.

### `PEOPLE-002` Real-time people list

- [x] Replace seeded people data with Firestore members stream.
- [x] Show display name, status, note, and last-updated freshness.
- [x] Visually distinguish stale/offline updates.
- [x] Keep list scannable on phone screens.

Implementation status:

- Code exists in `src/app/core/members/member-profile.ts` and `src/app/features/people/people-page.ts`.
- The People page subscribes to the authorized `members` collection in real time and renders display name, status, note, last-updated freshness, and hidden-location state.
- Stale updates and offline members have distinct row treatment while preserving text labels for accessibility.
- Browser QA covered a 390px-wide viewport with emulator-backed gate/onboarding/people flow, hidden-location member visibility, stale/offline row states, no horizontal overflow, and a live Firestore member update without refresh.

Depends on:

- `PEOPLE-001`

Acceptance criteria:

- Any authorized user can see the current group state.
- Users with hidden locations still appear.

## Milestone: Rally Points

### `RALLY-001` Create rally points

- [x] Add rally creation form.
- [x] Capture title, optional note, optional time, and map coordinates.
- [x] Save creator id and creator display name.
- [x] Display rally markers on the map.

Implementation status:

- Code exists in `src/app/core/rallies/rally-points.ts`, `src/app/features/map/map-page.ts`, and `src/app/features/rallies/rallies-page.ts`.
- The map page has an explicit New rally flow: open the rally form, tap the map for percentage coordinates, enter title, optional note, optional time, and create the rally point.
- Rally points are saved to `rallyPoints/{rallyPointId}` with title, note, `mapXPercent`, `mapYPercent`, `scheduledTime`, `createdByMemberId`, `createdByName`, `status`, and `expiresAt`.
- Active rally points stream back to the map as distinct rally markers and to the Rally Points list.
- Browser QA covered a 390px-wide emulator-backed gate/onboarding/map flow with rally form open, coordinate selection, rally creation, marker rendering, Rally Points list rendering, clean console logs, and emulator document field verification.

Depends on:

- `MAP-003`
- `AUTH-003`

Acceptance criteria:

- Any authorized user can create a rally point from the map.
- Rally points appear to the group in near real time.

### `RALLY-002` Rally responses

- [x] Add response buttons: Heading there, Arrived, Cannot make it.
- [x] Store one response per member per rally point.
- [x] Show response counts.
- [x] Show the current user's selected response.

Implementation status:

- Responses are stored as `rallyPoints/{rallyPointId}/responses/{uid}` documents with the
  rally point id, member id, response status, and server timestamp.
- The Rally Points page watches the response subcollection for every active rally point,
  renders live counts, and marks the current member's selected response.
- Firestore rules allow only an authorized user to create or update their own valid response
  under an active rally point.
- Browser QA covered a 390px-wide emulator-backed response change from Heading there to
  Arrived, including the selected state, updated counts, and clean console.

Depends on:

- `RALLY-001`
- `DEC-003` Rally responses storage shape.

Acceptance criteria:

- A user can change their response.
- Counts update correctly after response changes.

### `RALLY-003` Rally expiration

- [x] Support manual expiration.
- [x] Support scheduled-time based expiration behavior.
- [x] Hide or de-emphasize expired rally points.

Implementation status:

- A creator can end an active rally from the Rally Points list. This writes `status: expired`
  and a server timestamp to `expiresAt`; the document is retained as history.
- Selecting an optional rally time sets `expiresAt` to that time. Active list and map streams
  re-evaluate every 30 seconds, so scheduled-expired rallies disappear without a Firestore write.
- Firestore rules restrict manual expiration to the rally creator and prevent new responses
  after either manual or scheduled expiration.
- Emulator-backed Chrome QA covered a past scheduled rally hidden from the list and map,
  manual expiry removing a live rally from both surfaces, and retained expired documents.

Depends on:

- `RALLY-001`

Acceptance criteria:

- Expired rally points no longer look active on the map.
- Expiration does not delete history unexpectedly.

## Milestone: PWA and Deploy

### `DEPLOY-001` PWA support

- [x] Add Angular PWA support.
- [x] Decide offline/resync behavior.
- [x] Verify installable behavior on a phone browser.

Implementation status:

- Angular's production build registers `ngsw-worker.js` and emits `ngsw.json` plus a complete web
  app manifest with branded maskable icons from 72px through 512px.
- The service worker caches the app shell and static assets. Map images are cached lazily, while
  Firebase shared state and `/api/**` remain network-backed with no background write queue.
- Browser QA covered the production app at a 390x844 viewport with manifest/theme metadata,
  branded icon rendering, no horizontal overflow, a working gate control state, and clean console
  logs. Local production-server checks confirmed the manifest and service-worker response types.

Depends on:

- Core MVP flows working.

### `DEPLOY-002` Deployment docs

- [x] Document Firebase project setup.
- [x] Document required secrets.
- [x] Document local emulator smoke-test path.
- [x] Document map upload/config process.
- [x] Document deploy command.
- [x] Document post-deploy smoke test.

Implementation status:

- `docs/vercel-setup.md` documents versioned map assets, deployed-asset verification, the exact
  `appConfig/current` field types, authorized map QA, and config rollback.
- The release runbook verifies tests, API types, and the production build; deploys changed Firestore
  rules before dependent app code; and covers Git-based Vercel production deployment plus the
  authenticated CLI fallback.
- The post-deploy checklist covers the phone-sized password gate, onboarding/session behavior, map
  gestures and pins, status/People sync, rally create/respond/expire behavior, location hiding,
  profile persistence/sign-out, PWA installation, console health, and test-data cleanup.

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

- [x] Decide subcollection vs top-level collection.

Decision: `rallyPoints/{rallyPointId}/responses/{uid}`. One document per member keeps
response updates idempotent, gives simple ownership rules, and avoids a separate
collection query for each rally point.

### `DEC-004` Map setup path

- [x] Decide developer-configured URL vs protected upload screen.

Decision: use a developer-configured Vercel static asset or static URL for MVP. Firebase Storage is not worth a billing dependency for a non-sensitive convention map image.

### `DEC-005` Browser notifications

- [x] Decide whether basic browser notifications are in or after MVP.

Decision: after MVP. Use the `UX-008` in-app badge for rally awareness without notification
permission prompts or push infrastructure; revisit only if field use shows the badge is insufficient.

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
