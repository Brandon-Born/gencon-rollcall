import { describe, expect, it } from 'vitest';

import { isRallyPointExpired, isRallyPointMeetingNow } from './rally-points';
import type { RallyPoint } from '../models/rally-point';

const now = new Date('2026-07-30T18:00:00.000Z');

function rallyPoint(overrides: Partial<RallyPoint>): RallyPoint {
  return {
    id: 'rally-1',
    title: 'Meetup',
    note: '',
    mapXPercent: 50,
    mapYPercent: 50,
    scheduledTime: null,
    createdByMemberId: 'member-1',
    createdByName: 'Member',
    status: 'active',
    expiresAt: null,
    ...overrides,
  };
}

describe('isRallyPointExpired', () => {
  it('keeps active rallies without an expiry visible', () => {
    expect(isRallyPointExpired(rallyPoint({}), now)).toBe(false);
  });

  it('expires rallies at their scheduled expiry time', () => {
    expect(
      isRallyPointExpired(rallyPoint({ expiresAt: new Date('2026-07-30T17:59:59.000Z') }), now),
    ).toBe(true);
  });

  it('expires manually ended rallies regardless of their time', () => {
    expect(
      isRallyPointExpired(
        rallyPoint({ status: 'expired', expiresAt: new Date('2026-07-30T19:00:00.000Z') }),
        now,
      ),
    ).toBe(true);
  });

  it('expires no-time rallies when their default lifetime ends', () => {
    expect(
      isRallyPointExpired(
        rallyPoint({ scheduledTime: null, expiresAt: new Date('2026-07-30T18:00:00.000Z') }),
        now,
      ),
    ).toBe(true);
  });
});

describe('isRallyPointMeetingNow', () => {
  it('labels an active rally between its scheduled time and grace-period expiry', () => {
    expect(
      isRallyPointMeetingNow(
        rallyPoint({
          scheduledTime: new Date('2026-07-30T17:30:00.000Z'),
          expiresAt: new Date('2026-07-30T18:30:00.000Z'),
        }),
        now,
      ),
    ).toBe(true);
  });

  it('does not label a future or expired rally as meeting now', () => {
    expect(
      isRallyPointMeetingNow(
        rallyPoint({
          scheduledTime: new Date('2026-07-30T18:30:00.000Z'),
          expiresAt: new Date('2026-07-30T19:30:00.000Z'),
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isRallyPointMeetingNow(
        rallyPoint({
          scheduledTime: new Date('2026-07-30T17:00:00.000Z'),
          expiresAt: new Date('2026-07-30T18:00:00.000Z'),
        }),
        now,
      ),
    ).toBe(false);
  });
});
