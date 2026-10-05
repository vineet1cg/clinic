import { describe, expect, it } from 'vitest';
import {
  clinicClock,
  formatClinicDate,
  formatClinicDateTime,
  formatDateInput,
  parseDisplayDate,
} from './format.js';

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

  it('inserts date separators while the user types', () => {
    expect(formatDateInput('1')).toBe('1');
    expect(formatDateInput('12')).toBe('12/');
    expect(formatDateInput('1209')).toBe('12/09/');
    expect(formatDateInput('12/09/2000')).toBe('12/09/2000');
    expect(formatDateInput('12092000123')).toBe('12/09/2000');
  });
});
