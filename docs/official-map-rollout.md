# Official Gen Con 2026 Map Rollout

This document is the implementation reference for replacing the synthetic production map with the
official Gen Con Indy 2026 maps. This work is a release blocker: do not share the app with the
friend group until `MAP-001` through `MAP-003` are complete.

The user has approved use of the official map material for this private, personal friend-group app.
Do not turn this work into a public map product, map scraper, navigation service, or event-import
feature.

## Product Decisions

- The official 2026 **main Exhibit Hall** map is the default map shown on every fresh app session.
- The default is identified by the stable map id `exhibit-hall`; do not infer it from a floor number.
- Additional convention-center maps may use ids such as `basement`, `level-1`, `level-2`,
  `level-3`, and `level-4`.
- A member pin and rally point belong to exactly one `mapId` and use 0–100 percentage coordinates
  within that map image.
- Only the active map's pins and rally points are rendered.
- People and rally deep links must select the correct map before selecting and centering the target.
- Keep the synthetic local fixture for emulator and automated testing. Production must not use it.

Canonical source references:

- [Official Gen Con map](https://www.gencon.com/map)
- [Gen Con exhibitor information](https://www.gencon.com/exhibit/info)

## Target Map Manifest

Store versioned map assets under `public/maps/gencon-2026/` and add a static manifest. The exact
filenames may change during preparation, but the shape and stable ids should remain:

```json
{
  "id": "gencon-2026-v1",
  "displayName": "Gen Con Indy 2026",
  "defaultMapId": "exhibit-hall",
  "sourceUrl": "https://www.gencon.com/map",
  "capturedAt": "2026-07-10T00:00:00.000Z",
  "maps": [
    {
      "id": "exhibit-hall",
      "label": "Exhibit Hall",
      "shortLabel": "Exhibit",
      "imageUrl": "/maps/gencon-2026/exhibit-hall-v1.webp",
      "width": 4096,
      "height": 4096
    }
  ]
}
```

Add the remaining convention-center maps to `maps` after their exported dimensions are known.
Set `capturedAt` to the real capture time. The manifest should be small, cacheable, and contain no
member, rally, credential, or other private data.

Update `appConfig/current` to reference the manifest while retaining the current single-image
fields during the compatibility deployment:

```text
mapManifestUrl    string     "/maps/gencon-2026/manifest-v1.json"
mapDisplayName    string     "Gen Con Indy 2026"
mapImageUrl       string     <legacy fallback retained until cutover is verified>
updatedAt         timestamp  <current time>
```

The client should prefer `mapManifestUrl` and fall back to `mapImageUrl` for the synthetic local
fixture and safe staged deployment. Do not remove the fallback until emulator setup and rollback
instructions have been updated.

## Data Model

Add `mapId` to shared locations:

```text
members/{uid}.mapId                    string | null
rallyPoints/{rallyPointId}.mapId       string
```

Requirements:

- A visible member location requires a valid `mapId`, `mapXPercent`, and `mapYPercent`.
- Hiding a location clears or ignores all three location values consistently.
- A new rally stores the active `mapId` with its percentage coordinates.
- New writes accept only ids from the configured manifest or an explicit shared allowlist used by
  Firestore rules. Never accept arbitrary paths or URLs as `mapId`.
- Legacy records without `mapId` must not be rendered on an official map. Treat legacy member
  locations as hidden and exclude legacy rallies during cutover.

## Work Sequence

### `MAP-001` Prepare and verify official assets

1. Export the official 2026 main Exhibit Hall map and the required convention-center levels at a
   consistent, legible resolution.
2. Optimize each image for phone delivery without making room names or booth numbers unreadable.
3. Add versioned assets and the manifest under `public/maps/gencon-2026/`.
4. Verify recognizable halls, entrances, rooms, booth areas, orientation, and map labels against
   the official source.
5. Verify each deployed asset returns the expected image content type and the manifest returns
   JSON rather than the Angular fallback document.

Current asset set (captured 2026-07-11):

- `exhibit-hall-v1.webp` is a 3840×2270 floor-1 detail export with the official convention 27
  booth/area overlay and all 694 numbered exhibitor areas visible at source resolution.
- `basement-v1.webp` and `level-1-v1.webp` through `level-4-v1.webp` are 2050×2900 exports using a
  shared geographic extent for consistent orientation across the ICC and Lucas Oil Stadium.
- `manifest-v1.json` identifies official tile source version `v9`, records the source floor/zoom,
  dimensions, and SHA-256 digest for every immutable asset, and explicitly defaults to
  `exhibit-hall`.
- The level exports include the official floor-specific room/area overlays returned for Gen Con
  convention id 27; they are not bare venue base tiles.

### `MAP-002` Implement map selection and map-aware data

1. Extend app config loading with manifest validation and the legacy single-image fallback.
2. Add a compact, phone-friendly map selector. `Exhibit Hall` must be selected by default on a
   fresh load.
3. Load only the active image initially; avoid downloading the entire map set on first paint.
4. Save `mapId` with member pins and rally points, and filter markers by active map.
5. Make People and rally map links switch maps before centering and selecting the target.
6. Update models, Firebase writes, Firestore rules, emulator seeds, and focused unit/rule tests.

### `MAP-003` Cut over production and complete release QA

Synthetic coordinates do not correspond to the official maps. Perform this order:

1. Deploy the official assets and manifest.
2. Deploy compatible client code and Firestore rules.
3. Hide/reset all existing production member locations.
4. End or remove test rally points created against the synthetic map.
5. Update `appConfig/current` to the deployed manifest URL.
6. Verify production with two authorized users before sharing the URL and password.
7. Keep the previous asset/config values available until the production smoke test passes.

## Acceptance Gate

Completed in production on 2026-07-11. Two isolated authorized sessions at 430×844 exercised the
map-aware pin, rally, response, deep-link, cleanup, and privacy flows across the official map set.
The pre-cutover config was absent; conditional deletion back to that state and restoration of the
official config were both tested successfully.

`MAP-001` through `MAP-003` are complete only when all of the following are proven:

- A fresh phone session at 430×844 opens the official 2026 Exhibit Hall map by default.
- The map is legible while panning and zooming, with no clipping or broken assets.
- Every configured map can be selected, and each shows only its own pins and rallies.
- Pin place/move/Undo/hide and rally create/respond/end flows retain the correct `mapId`.
- People and rally deep links open the correct map and select the intended marker.
- A reload preserves valid map-aware locations but never displays legacy synthetic coordinates.
- Production contains no visible synthetic-map title, label, or image.
- Password authorization and Firestore privacy boundaries still behave as documented.
- `npm test`, `npm run typecheck:api`, `npm run test:rules`, and `npm run build` pass.
- The official source is rechecked shortly before group use; if it changed, publish a new versioned
  asset/manifest rather than silently replacing the existing files.

## Rollback

If production verification fails, restore the previous `appConfig/current` values. Do not restore
old synthetic pin coordinates onto an official map. Asset filenames are immutable once deployed;
publish corrections under a new version and update the manifest/config reference.
