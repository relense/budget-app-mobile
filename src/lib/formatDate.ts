const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Input is always a bare YYYY-MM-DD string (CLAUDE.md's dates convention) -- parsed by hand
// rather than via `new Date(dateString)`, which applies local-timezone shifting that a bare
// calendar date (no time-of-day) should never be subject to.
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

// Input is a bare YYYY-MM string (Query.currentMonth etc.) -- just the month name, matching
// the mockups (which show "September" alone, no year).
export function formatMonthLabel(yearMonth: string): string {
  const [, month] = yearMonth.split('-').map(Number);
  return MONTH_NAMES[month - 1];
}
