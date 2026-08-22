// Pure text-manipulation helpers backing a recurring expense's due-day entry via the shared
// AmountKeypad's calendar-toggle key (same mechanism add-transaction.tsx uses for its date,
// see dateInput.ts) -- but simpler: a due day (RecurringExpenseInput.dueDay, see docs/PLAN.md)
// is a bare Int with no calendar/month context, always 1-31 regardless of which real month it
// falls in, so none of dateInput.ts's month-aware day-count clamping (Feb, leap years, ISO
// conversion) applies here. Kept free of component state, same reasoning as amountInput.ts.

const MAX_DUE_DAY = 31;

// Rejects a keystroke that would push the day past 31 -- same "can't even be typed" guard as
// dateInput.ts's appendDayDigit, just without any month-specific cap.
export function appendDueDayDigit(dayDigits: string, digit: string): string {
  if (dayDigits.length >= 2) return dayDigits;
  if (dayDigits.length === 1) {
    const day = Number(dayDigits) * 10 + Number(digit);
    if (day < 1 || day > MAX_DUE_DAY) return dayDigits;
  }
  return dayDigits + digit;
}

export function backspaceDueDay(dayDigits: string): string {
  return dayDigits.slice(0, -1);
}

// Strips the leading zero once 2 digits are in (e.g. "08" -> "8"), matching dateInput.ts's
// formatTypedDay convention.
export function formatTypedDueDay(dayDigits: string): string {
  return dayDigits.length === 2 ? String(Number(dayDigits)) : dayDigits;
}

export function isValidDueDay(dayDigits: string): boolean {
  return dayDigits !== '' && Number(dayDigits) >= 1;
}
