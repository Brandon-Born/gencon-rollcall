import { describe, expect, it } from 'vitest';

import { mapPercentWithinBounds } from './map-coordinate';

const bounds = { left: 100, top: 50, width: 400, height: 200 };

describe('mapPercentWithinBounds', () => {
  it('converts points inside the image to percentages', () => {
    expect(mapPercentWithinBounds({ x: 300, y: 100 }, bounds)).toEqual({ x: 50, y: 25 });
  });

  it('keeps taps exactly on the image edge valid', () => {
    expect(mapPercentWithinBounds({ x: 100, y: 50 }, bounds)).toEqual({ x: 0, y: 0 });
    expect(mapPercentWithinBounds({ x: 500, y: 250 }, bounds)).toEqual({ x: 100, y: 100 });
  });

  it('rejects taps in every surrounding letterbox band', () => {
    expect(mapPercentWithinBounds({ x: 99, y: 100 }, bounds)).toBeNull();
    expect(mapPercentWithinBounds({ x: 501, y: 100 }, bounds)).toBeNull();
    expect(mapPercentWithinBounds({ x: 300, y: 49 }, bounds)).toBeNull();
    expect(mapPercentWithinBounds({ x: 300, y: 251 }, bounds)).toBeNull();
  });

  it('rejects invalid image bounds', () => {
    expect(mapPercentWithinBounds({ x: 100, y: 50 }, { ...bounds, width: 0 })).toBeNull();
  });
});
