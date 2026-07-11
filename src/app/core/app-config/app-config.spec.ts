import { describe, expect, it } from 'vitest';

import { createLegacyAppConfig, validateMapManifest } from './app-config';

const validManifest = {
  id: 'gencon-2026-v1',
  displayName: 'Gen Con Indy 2026',
  defaultMapId: 'exhibit-hall',
  maps: [
    {
      id: 'exhibit-hall',
      label: 'Exhibit Hall',
      shortLabel: 'Exhibit',
      imageUrl: '/maps/gencon-2026/exhibit-hall-v1.webp',
      width: 3840,
      height: 2270,
    },
    {
      id: 'level-2',
      label: 'Convention Level 2',
      shortLabel: '2',
      imageUrl: '/maps/gencon-2026/level-2-v1.webp',
      width: 2050,
      height: 2900,
    },
  ],
};

describe('validateMapManifest', () => {
  it('accepts a valid manifest and retains the explicit Exhibit Hall default', () => {
    const manifest = validateMapManifest(validManifest);

    expect(manifest.defaultMapId).toBe('exhibit-hall');
    expect(manifest.maps.map((map) => map.id)).toEqual(['exhibit-hall', 'level-2']);
  });

  it('rejects an unknown default, duplicate ids, and incomplete map entries', () => {
    expect(() =>
      validateMapManifest({ ...validManifest, defaultMapId: 'not-configured' }),
    ).toThrow();
    expect(() =>
      validateMapManifest({
        ...validManifest,
        maps: [validManifest.maps[0], validManifest.maps[0]],
      }),
    ).toThrow();
    expect(() =>
      validateMapManifest({
        ...validManifest,
        maps: [{ ...validManifest.maps[0], imageUrl: '' }],
      }),
    ).toThrow();
  });
});

describe('createLegacyAppConfig', () => {
  it('builds a single named fallback map without requiring a manifest', () => {
    const config = createLegacyAppConfig({
      mapId: 'local-dev',
      mapImageUrl: '/maps/local-dev-map.svg',
      mapDisplayName: 'Local Convention Test Map',
      updatedAt: new Date('2026-07-11T00:00:00.000Z'),
    });

    expect(config.defaultMapId).toBe('local-dev');
    expect(config.maps).toEqual([
      expect.objectContaining({ id: 'local-dev', imageUrl: '/maps/local-dev-map.svg' }),
    ]);
  });
});
