export const MEDICATION_TIMES = Object.freeze(['Morning', 'Afternoon', 'Night']);

export const MEDICATION_MEAL_TIMINGS = Object.freeze(['Before meal', 'After meal']);

export function medicationScheduleSlot(mealTiming, time) {
  return `${mealTiming}:${time}`;
}

const MEDICATION_SCHEDULE_SLOTS = Object.freeze(
  MEDICATION_MEAL_TIMINGS.flatMap((mealTiming) =>
    MEDICATION_TIMES.map((time) => medicationScheduleSlot(mealTiming, time)),
  ),
);

export const DURATION_UNITS = Object.freeze(['day', 'week', 'month']);

export function parseMedicationFrequency(value = '') {
  const schedule = value.trim();
  if (!schedule) return { selected: [], custom: '' };

  const selected = [];
  const groups = schedule.split(';').map((group) => group.trim());
  let valid = groups.length > 0;

  groups.forEach((group) => {
    const separatorIndex = group.indexOf(':');
    const mealTiming = group.slice(0, separatorIndex).trim();
    const times = group
      .slice(separatorIndex + 1)
      .split(',')
      .map((time) => time.trim())
      .filter(Boolean);

    if (
      separatorIndex < 0 ||
      !MEDICATION_MEAL_TIMINGS.includes(mealTiming) ||
      !times.length ||
      times.some((time) => !MEDICATION_TIMES.includes(time))
    ) {
      valid = false;
      return;
    }

    times.forEach((time) => selected.push(medicationScheduleSlot(mealTiming, time)));
  });

  return {
    selected: valid ? MEDICATION_SCHEDULE_SLOTS.filter((slot) => selected.includes(slot)) : [],
    custom: valid ? '' : schedule,
  };
}

export function formatMedicationFrequency(values = []) {
  return MEDICATION_MEAL_TIMINGS.map((mealTiming) => {
    const times = MEDICATION_TIMES.filter((time) =>
      values.includes(medicationScheduleSlot(mealTiming, time)),
    );
    return times.length ? `${mealTiming}: ${times.join(', ')}` : '';
  })
    .filter(Boolean)
    .join('; ');
}

export function parseMedicationRowSchedule(value = '') {
  const parsed = parseMedicationFrequency(value);
  if (parsed.custom) {
    return { mealTiming: 'After meal', times: [], custom: parsed.custom };
  }

  const selectedMealTimings = MEDICATION_MEAL_TIMINGS.filter((mealTiming) =>
    MEDICATION_TIMES.some((time) =>
      parsed.selected.includes(medicationScheduleSlot(mealTiming, time)),
    ),
  );
  if (selectedMealTimings.length > 1) {
    return { mealTiming: selectedMealTimings[0], times: [], custom: value.trim() };
  }

  const mealTiming = selectedMealTimings[0] || 'After meal';
  return {
    mealTiming,
    times: MEDICATION_TIMES.filter((time) =>
      parsed.selected.includes(medicationScheduleSlot(mealTiming, time)),
    ),
    custom: '',
  };
}

export function parseMedicationDuration(value = '') {
  const match = value.trim().match(/^(\d+)\s+(day|week|month)s?$/i);
  if (!match) return { amount: '', unit: 'day', custom: value.trim() };
  return { amount: match[1], unit: match[2].toLowerCase(), custom: '' };
}

export function formatMedicationDuration(amount, unit) {
  if (amount === '' || amount === undefined || amount === null) return '';
  const numericAmount = Number(amount);
  if (!Number.isInteger(numericAmount) || numericAmount < 1) return '';
  const safeUnit = DURATION_UNITS.includes(unit) ? unit : 'day';
  return `${numericAmount} ${safeUnit}${numericAmount === 1 ? '' : 's'}`;
}
