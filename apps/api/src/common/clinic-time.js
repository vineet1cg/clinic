import { env } from '../config/env.js';
import { ClinicSettings } from '../models/clinic-settings.model.js';

function partsInTimeZone(date, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  );
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateInTimeZone(date, timeZone) {
  const parts = partsInTimeZone(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function localMidnightToUtc(dateString, timeZone) {
  const [year, month, day] = dateString.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = target;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsInTimeZone(new Date(guess), timeZone);
    const observed = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    guess += target - observed;
  }

  return new Date(guess);
}

export function dateRangeInTimeZone(from, to, timeZone) {
  return {
    $gte: localMidnightToUtc(from, timeZone),
    $lt: localMidnightToUtc(addDays(to, 1), timeZone),
  };
}

export async function getClinicTimeZone(clinicId) {
  const settings = await ClinicSettings.findOne({ clinicId }).select('timezone').lean();
  return settings?.timezone || env.CLINIC_TIMEZONE;
}

export async function clinicToday(clinicId, now = new Date()) {
  return dateInTimeZone(now, await getClinicTimeZone(clinicId));
}

export async function clinicDateRange(clinicId, from, to) {
  return dateRangeInTimeZone(from, to, await getClinicTimeZone(clinicId));
}
