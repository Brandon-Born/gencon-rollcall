# Backlog

Track work here until a dedicated issue tracker exists.

## Now

- [x] Scaffold Angular 21 standalone app.
- [x] Add Firebase project configuration placeholders and environment documentation.
- [x] Build password gate UI.
- [ ] Implement server-side shared-password verification endpoint.
- [ ] Enable anonymous auth and authorized session persistence.
- [x] Add Firestore security rules for authorized shared access.

## Next

- [x] Add onboarding display-name flow.
- [x] Create typed data models.
- [x] Add app shell with bottom navigation: Map, People, Rally Points, Settings.
- [ ] Add map config document and Firebase Storage map image loading.
- [ ] Implement mobile map pan/zoom.
- [ ] Implement manual pin placement with percentage coordinates.
- [ ] Add status and short note editing.
- [ ] Add hide-location control.

## Rally Points

- [ ] Create rally point form.
- [ ] Display rally markers on the map.
- [ ] Add response buttons: Heading there, Arrived, Cannot make it.
- [ ] Show response counts.
- [ ] Support manual expiration.
- [ ] Add scheduled-time auto-expiration behavior.

## Polish and PWA

- [ ] Add installable Angular PWA support.
- [ ] Add offline/resync behavior decision.
- [ ] Tune mobile gesture handling.
- [ ] Add loading, empty, and error states.
- [ ] Add responsive tablet/desktop layout.
- [ ] Add deployment instructions.

## Deferred

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

## Decisions to Make

- [ ] Firebase Functions vs Cloud Run for password validation.
- [ ] Authorization document vs Firebase custom claim for shared data access.
- [ ] Rally responses as subcollection vs top-level collection.
- [ ] Map setup path: developer-configured URL vs protected upload screen.
- [ ] Whether to include basic browser notifications after MVP.
