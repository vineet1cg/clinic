export function calculateAge(dateOfBirth, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || ''))
    return undefined;
  if (dateOfBirth > today) return undefined;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth)
    return undefined;
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number);
  return (
    currentYear -
    year -
    (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0)
  );
}
