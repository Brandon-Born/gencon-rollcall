import { describe, expect, it } from 'vitest';

import { memberNameKey, normalizeDisplayName } from './member-name';

describe('member display-name normalization', () => {
  it('matches names without regard to case or repeated surrounding whitespace', () => {
    expect(memberNameKey('  rEsToRe   pRoOf  ')).toBe(memberNameKey('Restore Proof'));
  });

  it('preserves the submitted casing for a new member while normalizing spacing', () => {
    expect(normalizeDisplayName('  Maya   McFly  ')).toBe('Maya McFly');
  });

  it('limits names to the existing 32-character member-field maximum', () => {
    expect(normalizeDisplayName('a'.repeat(40))).toHaveLength(32);
  });
});
