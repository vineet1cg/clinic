import { describe, expect, it } from 'vitest';
import { clinicClock, formatClinicDate, formatClinicDateTime, parseDisplayDate } from './format.js';

describe('clinic dates', () => {
  it('shows padded day/month/year while retaining ISO storage', () => {
    expect(formatClinicDate('2026-01-02')).toBe('02/01/2026');
    expect(parseDisplayDate('02/01/2026')).toBe('2026-01-02');
    expect(parseDisplayDate('31/02/2026')).toBe('31/02/2026');
    expect(parseDisplayDate('02/')).toBe('02/');
  });
  it('uses clinic time across UTC midnight boundaries', () => {
    const now = new Date('2026-09-19T20:15:00Z');
    expect(clinicClock(now)).toEqual({ date: '2026-09-20', time: '01:45' });
    expect(clinicClock(now, 'UTC')).toEqual({ date: '2026-09-19', time: '20:15' });
    expect(formatClinicDateTime(now)).toBe('20/09/2026 01:45');
  });
});
