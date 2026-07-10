import { describe, expect, it } from 'vitest';

import { peopleSummaryLabel } from './people-summary';

describe('peopleSummaryLabel', () => {
  it('counts only fresh, non-offline members as active', () => {
    expect(
      peopleSummaryLabel([
        { isOffline: false, isStale: false },
        { isOffline: false, isStale: true },
        { isOffline: true, isStale: false },
      ]),
    ).toBe('1/3 active');
  });

  it('reports an empty group without inventing active members', () => {
    expect(peopleSummaryLabel([])).toBe('0/0 active');
  });
});
