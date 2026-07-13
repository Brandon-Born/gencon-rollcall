import { describe, expect, it } from 'vitest';

import { mapMarkerZIndexes, type StackableMapMarker } from './map-marker-stacking';

const memberMarker: StackableMapMarker = {
  key: 'member:alex',
  xPercent: 50,
  yPercent: 50,
  diameterPx: 46,
  baseZIndex: 2,
};

const rallyMarker: StackableMapMarker = {
  key: 'rally:lunch',
  xPercent: 50,
  yPercent: 50,
  diameterPx: 42,
  baseZIndex: 3,
};

describe('map marker stacking', () => {
  it('alternates which coincident member and rally marker is in front', () => {
    const firstStep = mapMarkerZIndexes([memberMarker, rallyMarker], 400, 600, 1, 0, null);
    const secondStep = mapMarkerZIndexes([memberMarker, rallyMarker], 400, 600, 1, 1, null);

    expect([firstStep.get(memberMarker.key), secondStep.get(memberMarker.key)]).toEqual([8, 2]);
    expect([firstStep.get(rallyMarker.key), secondStep.get(rallyMarker.key)]).toEqual([3, 8]);
  });

  it('keeps separated markers at their normal stacking levels', () => {
    const separatedRally = { ...rallyMarker, xPercent: 80 };

    const zIndexes = mapMarkerZIndexes([memberMarker, separatedRally], 400, 600, 1, 5, null);

    expect(zIndexes.get(memberMarker.key)).toBe(2);
    expect(zIndexes.get(separatedRally.key)).toBe(3);
  });

  it('stops rotating markers that separate as the map is zoomed', () => {
    const nearbyRally = { ...rallyMarker, xPercent: 58 };

    const fitted = mapMarkerZIndexes([memberMarker, nearbyRally], 400, 600, 1, 0, null);
    const zoomed = mapMarkerZIndexes([memberMarker, nearbyRally], 400, 600, 4, 0, null);

    expect(fitted.get(memberMarker.key)).toBe(8);
    expect(zoomed.get(memberMarker.key)).toBe(2);
  });

  it('keeps the selected marker above the rotating marker', () => {
    const zIndexes = mapMarkerZIndexes(
      [memberMarker, rallyMarker],
      400,
      600,
      1,
      0,
      rallyMarker.key,
    );

    expect(zIndexes.get(memberMarker.key)).toBe(8);
    expect(zIndexes.get(rallyMarker.key)).toBe(20);
  });

  it('cycles every marker in a larger overlap group', () => {
    const secondMember = { ...memberMarker, key: 'member:bea' };
    const markers = [memberMarker, secondMember, rallyMarker];

    const frontMarkers = markers.map((_, step) => {
      const zIndexes = mapMarkerZIndexes(markers, 400, 600, 1, step, null);
      return markers.find((marker) => zIndexes.get(marker.key) === 8)?.key;
    });

    expect(new Set(frontMarkers)).toEqual(new Set(markers.map((marker) => marker.key)));
  });
});
