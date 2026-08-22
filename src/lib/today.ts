// Extracted into its own function so screens needing "today" as a bare date can mock it in
// tests instead of depending on the real system clock. Built from local date parts, not
// `toISOString()` (which is UTC and can shift the calendar day near midnight) -- same "bare
// YYYY-MM-DD, no timezone-shifting" rule as every other date in this app (see formatDate.ts).
export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
