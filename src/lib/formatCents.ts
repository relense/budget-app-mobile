// Always 2 decimals + thousands separators, regardless of what the mockups' placeholder data
// happened to show (which was inconsistent -- "€23" vs "€194.2" vs "€3,686.00") -- a finance
// app should format money consistently, not mirror mockup placeholder inconsistency.
const formatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}
