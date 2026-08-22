// Pure text-manipulation helpers backing the amount keypad's date-entry mode (the calendar
// key on add-transaction/edit-transaction's keypad). Only the DAY is ever typed: a transaction
// is always dated within the current active month -- its categoryMonthId already only ever
// comes from the current month's active categories, and every earlier month is locked -- so
// month/year are fixed to that month and shown for context, not typed. Kept free of component
// state, same reasoning as amountInput.ts.

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const [year, month] = yearMonth.split('-').map(Number);
  return { year, month };
}

export function daysInCurrentMonth(currentMonth: string): number {
  const { year, month } = parseYearMonth(currentMonth);
  // Day 0 of the *next* month is the last day of this one -- handles Feb/leap years for free.
  return new Date(year, month, 0).getDate();
}

// Rejects a keystroke that can't lead to a real day in this specific month -- e.g. a 2nd digit
// pushing the day past daysInCurrentMonth, so a day that doesn't exist (30 Feb, 31 Apr) can
// never actually be typed in the first place, unlike a generic 1-31 cap.
export function appendDayDigit(dayDigits: string, digit: string, currentMonth: string): string {
  if (dayDigits.length >= 2) return dayDigits;
  if (dayDigits.length === 1) {
    const day = Number(dayDigits) * 10 + Number(digit);
    if (day < 1 || day > daysInCurrentMonth(currentMonth)) return dayDigits;
  }
  return dayDigits + digit;
}

export function backspaceDay(dayDigits: string): string {
  return dayDigits.slice(0, -1);
}

// Strips the leading zero once 2 digits are in (e.g. "08" -> "8"), matching formatDate.ts's
// convention elsewhere in the app -- a single typed digit is shown raw.
export function formatTypedDay(dayDigits: string): string {
  return dayDigits.length === 2 ? String(Number(dayDigits)) : dayDigits;
}

// A "0" alone isn't a real day yet (only a valid prefix for "01"-"09") -- everything else
// non-empty is already guaranteed in-range by appendDayDigit's per-keystroke guard.
export function isCompleteDayDigits(dayDigits: string): boolean {
  return dayDigits !== '' && Number(dayDigits) >= 1;
}

export function dayDigitsToIso(dayDigits: string, currentMonth: string): string | null {
  if (!isCompleteDayDigits(dayDigits)) return null;
  const { year, month } = parseYearMonth(currentMonth);
  const day = String(Number(dayDigits)).padStart(2, '0');
  return `${year}-${String(month).padStart(2, '0')}-${day}`;
}

export function isoDateToDayDigits(isoDate: string): string {
  const [, , day] = isoDate.split('-');
  return String(Number(day));
}

export function formatMonthYearLabel(currentMonth: string): string {
  const { year, month } = parseYearMonth(currentMonth);
  return `${MONTH_ABBREVIATIONS[month - 1]} ${year}`;
}
