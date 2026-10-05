import { describe, expect, it } from 'vitest';
import {
  formatMedicationDuration,
  formatMedicationFrequency,
  parseMedicationDuration,
  parseMedicationFrequency,
  parseMedicationRowSchedule,
} from './prescription.js';

describe('prescription form normalization', () => {
  it('stores meal-relative medicine times in a stable table order', () => {
    expect(
      formatMedicationFrequency([
        'After meal:Night',
        'Before meal:Afternoon',
        'Before meal:Morning',
      ]),
    ).toBe('Before meal: Morning, Afternoon; After meal: Night');
    expect(parseMedicationFrequency('Before meal: Morning, Afternoon; After meal: Night')).toEqual({
      selected: ['Before meal:Morning', 'Before meal:Afternoon', 'After meal:Night'],
      custom: '',
    });
  });

  it('keeps all six dose slots inside the API 80-character limit', () => {
    const frequency = formatMedicationFrequency([
      'Before meal:Morning',
      'Before meal:Afternoon',
      'Before meal:Night',
      'After meal:Morning',
      'After meal:Afternoon',
      'After meal:Night',
    ]);
    expect(frequency).toBe(
      'Before meal: Morning, Afternoon, Night; After meal: Morning, Afternoon, Night',
    );
    expect(frequency.length).toBeLessThanOrEqual(80);
  });

  it('preserves awareness of older free-text schedules', () => {
    expect(parseMedicationFrequency('Twice daily after food')).toEqual({
      selected: [],
      custom: 'Twice daily after food',
    });
  });

  it('adapts a single meal timing to the row-based schedule', () => {
    expect(parseMedicationRowSchedule('After meal: Morning, Night')).toEqual({
      mealTiming: 'After meal',
      times: ['Morning', 'Night'],
      custom: '',
    });
  });

  it('flags mixed meal timings that cannot fit one dropdown', () => {
    const value = 'Before meal: Morning; After meal: Night';
    expect(parseMedicationRowSchedule(value)).toEqual({
      mealTiming: 'Before meal',
      times: [],
      custom: value,
    });
  });

  it('normalizes duration amounts and units', () => {
    expect(formatMedicationDuration('1', 'day')).toBe('1 day');
    expect(formatMedicationDuration('3', 'week')).toBe('3 weeks');
    expect(parseMedicationDuration('3 weeks')).toEqual({
      amount: '3',
      unit: 'week',
      custom: '',
    });
  });
});
