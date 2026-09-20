import { describe, expect, it } from 'vitest';
import { dateInTimeZone, dateRangeInTimeZone } from './clinic-time.js';

describe('clinic time boundaries', () => {
  it('uses the clinic date rather than the UTC date', () => {
    expect(dateInTimeZone(new Date('2026-09-14T20:00:00.000Z'), 'Asia/Kolkata')).toBe('2026-09-15');
  });

  it('converts an India clinic day to an exclusive UTC range', () => {
    expect(dateRangeInTimeZone('2026-09-15', '2026-09-15', 'Asia/Kolkata')).toEqual({
      $gte: new Date('2026-09-14T18:30:00.000Z'),
      $lt: new Date('2026-09-15T18:30:00.000Z'),
    });
  });
});
