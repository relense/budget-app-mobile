import {
  appendDueDayDigit,
  backspaceDueDay,
  formatTypedDueDay,
  isValidDueDay,
} from '../../../src/lib/dueDayInput';

describe('appendDueDayDigit', () => {
  it('appends a first digit', () => {
    expect(appendDueDayDigit('', '2')).toBe('2');
  });

  it('appends a second digit that keeps the day in range', () => {
    expect(appendDueDayDigit('2', '1')).toBe('21');
  });

  it('rejects a second digit that would push the day past 31', () => {
    expect(appendDueDayDigit('3', '2')).toBe('3');
  });

  it('allows 31 exactly', () => {
    expect(appendDueDayDigit('3', '1')).toBe('31');
  });

  it('ignores a third digit once two are already typed', () => {
    expect(appendDueDayDigit('21', '5')).toBe('21');
  });

  it('is not tied to any specific calendar month -- unlike a real date, every day 1-31 is a valid due day', () => {
    // A due day has no month/year context (see docs/PLAN.md's RecurringExpense.dueDay --
    // just an Int, no calendar validation), so 31 must be reachable regardless of "which
    // month" -- there is no such month here, deliberately.
    expect(appendDueDayDigit('3', '1')).toBe('31');
  });
});

describe('backspaceDueDay', () => {
  it('removes the last digit', () => {
    expect(backspaceDueDay('21')).toBe('2');
  });

  it('returns empty from a single digit', () => {
    expect(backspaceDueDay('2')).toBe('');
  });

  it('stays empty when already empty', () => {
    expect(backspaceDueDay('')).toBe('');
  });
});

describe('formatTypedDueDay', () => {
  it('strips the leading zero once two digits are in', () => {
    expect(formatTypedDueDay('08')).toBe('8');
  });

  it('shows a single typed digit raw', () => {
    expect(formatTypedDueDay('8')).toBe('8');
  });

  it('shows empty as empty', () => {
    expect(formatTypedDueDay('')).toBe('');
  });
});

describe('isValidDueDay', () => {
  it('is false when empty', () => {
    expect(isValidDueDay('')).toBe(false);
  });

  it('is false for 0', () => {
    expect(isValidDueDay('0')).toBe(false);
  });

  it('is true for 1', () => {
    expect(isValidDueDay('1')).toBe(true);
  });

  it('is true for 31', () => {
    expect(isValidDueDay('31')).toBe(true);
  });
});
