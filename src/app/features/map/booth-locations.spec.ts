import { describe, expect, it } from 'vitest';

import { boothLocationCount, findBoothLocation, normalizeBoothLabel } from './booth-locations';

describe('Exhibit Hall booth locations', () => {
  it('contains every numbered official map area', () => {
    expect(boothLocationCount).toBe(694);
  });

  it('normalizes common booth entry formats', () => {
    expect(normalizeBoothLabel(' booth #1401 ')).toBe('1401');
    expect(normalizeBoothLabel(' aa ')).toBe('AA');
  });

  it('finds numeric, Art Show, and Author Avenue booths within map bounds', () => {
    for (const value of ['1401', '10', 'AA']) {
      const booth = findBoothLocation(value);

      expect(booth).not.toBeNull();
      expect(booth!.xPercent).toBeGreaterThanOrEqual(0);
      expect(booth!.xPercent).toBeLessThanOrEqual(100);
      expect(booth!.yPercent).toBeGreaterThanOrEqual(0);
      expect(booth!.yPercent).toBeLessThanOrEqual(100);
    }
  });

  it('keeps known booth centers aligned with the immutable Exhibit Hall crop', () => {
    expect(findBoothLocation('100')).toEqual({
      number: '100',
      xPercent: 2.99479,
      yPercent: 72.90749,
    });
    expect(findBoothLocation('1401')).toEqual({
      number: '1401',
      xPercent: 46.22396,
      yPercent: 71.14537,
    });
    expect(findBoothLocation('AA')).toEqual({
      number: 'AA',
      xPercent: 32.24229,
      yPercent: 23.66414,
    });
  });

  it('rejects an unknown booth', () => {
    expect(findBoothLocation('9999')).toBeNull();
  });
});
