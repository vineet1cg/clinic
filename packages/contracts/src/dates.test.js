import { describe, expect, it } from 'vitest';
import { calculateAge } from './dates.js';

describe('age in completed years', () => {
  it('handles the birthday boundary', () => {
    expect(calculateAge('2000-09-20', '2026-09-19')).toBe(25);
    expect(calculateAge('2000-09-20', '2026-09-20')).toBe(26);
    expect(calculateAge('2026-09-20', '2026-09-20')).toBe(0);
  });
  it('handles leap dates without inventing a birth date', () => {
    expect(calculateAge('2000-02-29', '2025-02-28')).toBe(24);
    expect(calculateAge('2000-02-29', '2025-03-01')).toBe(25);
    expect(calculateAge(undefined, '2026-09-20')).toBeUndefined();
  });
  it('rejects invalid or future dates', () => {
    expect(calculateAge('2026-02-30', '2026-09-20')).toBeUndefined();
    expect(calculateAge('2026-09-21', '2026-09-20')).toBeUndefined();
  });
});
