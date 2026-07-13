import { describe, expect, it } from 'vitest';

import {
  arrivalLocationForResponse,
  isRallyPointExpired,
  isRallyPointMeetingNow,
} from './rally-points';
import type { RallyPoint } from '../models/rally-point';

const now = new Date('2026-07-30T18:00:00.000Z');

function rallyPoint(overrides: Partial<RallyPoint>): RallyPoint {
  return {
    id: 'rally-1',
    title: 'Meetup',
    note: '',
    mapId: 'exhibit-hall',
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

describe('arrivalLocationForResponse', () => {
  it('uses the rally map and coordinates for an arrived response', () => {
    expect(
      arrivalLocationForResponse(
        rallyPoint({ mapId: 'level-2', mapXPercent: 42.1234, mapYPercent: 67.8906 }),
        'arrived',
      ),
    ).toEqual({
      mapId: 'level-2',
      mapXPercent: 42.123,
      mapYPercent: 67.891,
    });
  });

  it('does not move a pin for non-arrival responses', () => {
    expect(arrivalLocationForResponse(rallyPoint({}), 'heading-there')).toBeNull();
    expect(arrivalLocationForResponse(rallyPoint({}), 'cannot-make-it')).toBeNull();
  });

  it('rejects an arrived response without a valid map location', () => {
    expect(arrivalLocationForResponse(rallyPoint({ mapId: null }), 'arrived')).toBeNull();
    expect(arrivalLocationForResponse(rallyPoint({ mapXPercent: 101 }), 'arrived')).toBeNull();
  });
});
