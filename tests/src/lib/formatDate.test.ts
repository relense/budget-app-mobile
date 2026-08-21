import { formatDate, formatMonthLabel } from '../../../src/lib/formatDate';

describe('formatDate', () => {
  it('formats a bare YYYY-MM-DD date as "D Month YYYY"', () => {
    expect(formatDate('2026-09-02')).toBe('2 September 2026');
  });

  it('does not zero-pad the day', () => {
    expect(formatDate('2026-09-01')).toBe('1 September 2026');
  });

  it('handles December correctly', () => {
    expect(formatDate('2026-12-25')).toBe('25 December 2026');
  });
});

describe('formatMonthLabel', () => {
  it('returns just the month name, no year', () => {
    expect(formatMonthLabel('2026-09')).toBe('September');
  });
});
