import {
  appendDayDigit,
  backspaceDay,
  dayDigitsToIso,
  daysInCurrentMonth,
  formatMonthYearLabel,
  formatTypedDay,
  isCompleteDayDigits,
  isoDateToDayDigits,
} from '../../../src/lib/dateInput';

describe('daysInCurrentMonth', () => {
  it('returns 30 for April', () => {
    expect(daysInCurrentMonth('2026-04')).toBe(30);
  });

  it('returns 30 for September', () => {
    expect(daysInCurrentMonth('2026-09')).toBe(30);
  });

  it('returns 31 for October', () => {
    expect(daysInCurrentMonth('2026-10')).toBe(31);
  });

  it('returns 28 for February on a non-leap year', () => {
    expect(daysInCurrentMonth('2023-02')).toBe(28);
  });

  it('returns 29 for February on a leap year', () => {
    expect(daysInCurrentMonth('2024-02')).toBe(29);
  });
});

describe('appendDayDigit', () => {
  it('appends a first digit', () => {
    expect(appendDayDigit('', '2', '2026-09')).toBe('2');
  });

  it('appends a second digit that keeps the day in range', () => {
    expect(appendDayDigit('2', '1', '2026-09')).toBe('21');
  });

  it('rejects a second digit that would push the day past the month\'s real length', () => {
    expect(appendDayDigit('3', '1', '2026-04')).toBe('3'); // April has 30 days, not 31
  });

  it('caps the buffer at 2 digits', () => {
    expect(appendDayDigit('21', '5', '2026-09')).toBe('21');
  });
});

describe('backspaceDay', () => {
  it('removes the last digit', () => {
    expect(backspaceDay('21')).toBe('2');
  });

  it('returns an empty string when already empty', () => {
    expect(backspaceDay('')).toBe('');
  });
});

describe('formatTypedDay', () => {
  it('shows a single digit raw', () => {
    expect(formatTypedDay('2')).toBe('2');
  });

  it('strips the leading zero once 2 digits are typed', () => {
    expect(formatTypedDay('08')).toBe('8');
  });

  it('shows a 2-digit day as-is when there is no leading zero', () => {
    expect(formatTypedDay('21')).toBe('21');
  });
});

describe('isCompleteDayDigits', () => {
  it('is false for an empty buffer', () => {
    expect(isCompleteDayDigits('')).toBe(false);
  });

  it('is false for a lone "0" (not a real day, just a prefix)', () => {
    expect(isCompleteDayDigits('0')).toBe(false);
  });

  it('is true for a single non-zero digit', () => {
    expect(isCompleteDayDigits('2')).toBe(true);
  });

  it('is true for a complete 2-digit day', () => {
    expect(isCompleteDayDigits('21')).toBe(true);
  });
});

describe('dayDigitsToIso', () => {
  it('combines the typed day with the current month/year', () => {
    expect(dayDigitsToIso('21', '2026-09')).toBe('2026-09-21');
  });

  it('pads a single-digit day', () => {
    expect(dayDigitsToIso('2', '2026-09')).toBe('2026-09-02');
  });

  it('returns null for an incomplete buffer', () => {
    expect(dayDigitsToIso('0', '2026-09')).toBeNull();
    expect(dayDigitsToIso('', '2026-09')).toBeNull();
  });
});

describe('isoDateToDayDigits', () => {
  it('extracts the day, without a leading zero', () => {
    expect(isoDateToDayDigits('2026-09-02')).toBe('2');
  });

  it('round-trips with dayDigitsToIso', () => {
    expect(dayDigitsToIso(isoDateToDayDigits('2026-09-21'), '2026-09')).toBe('2026-09-21');
  });
});

describe('formatMonthYearLabel', () => {
  it('formats the current month as an abbreviated month + year', () => {
    expect(formatMonthYearLabel('2026-09')).toBe('Sep 2026');
  });
});
