import {
  amountTextToCents,
  appendDecimalPoint,
  appendDigit,
  backspaceAmount,
  centsToAmountText,
} from '../../../src/lib/amountInput';

describe('appendDigit', () => {
  it('appends a digit to the running text', () => {
    expect(appendDigit('7', '0')).toBe('70');
  });

  it('replaces a lone leading zero instead of appending to it', () => {
    expect(appendDigit('0', '5')).toBe('5');
  });

  it('caps decimals at 2 digits after the point', () => {
    expect(appendDigit('1.50', '5')).toBe('1.50');
  });

  it('allows a single decimal digit to be appended', () => {
    expect(appendDigit('1.5', '0')).toBe('1.50');
  });
});

describe('appendDecimalPoint', () => {
  it('adds a leading zero before the point on empty text', () => {
    expect(appendDecimalPoint('')).toBe('0.');
  });

  it('appends a point to existing digits', () => {
    expect(appendDecimalPoint('12')).toBe('12.');
  });

  it('is a no-op if a point already exists', () => {
    expect(appendDecimalPoint('12.5')).toBe('12.5');
  });
});

describe('backspaceAmount', () => {
  it('removes the last character', () => {
    expect(backspaceAmount('12.5')).toBe('12.');
  });

  it('returns an empty string when already empty', () => {
    expect(backspaceAmount('')).toBe('');
  });
});

describe('amountTextToCents', () => {
  it('converts a plain amount string to integer cents', () => {
    expect(amountTextToCents('9.68')).toBe(968);
  });

  it('treats an empty string as 0', () => {
    expect(amountTextToCents('')).toBe(0);
  });

  it('treats a trailing lone point as 0', () => {
    expect(amountTextToCents('0.')).toBe(0);
  });

  it('handles a whole number with no decimal point', () => {
    expect(amountTextToCents('700')).toBe(70000);
  });
});

describe('centsToAmountText', () => {
  it('formats whole-euro cents with 2 decimal places', () => {
    expect(centsToAmountText(70000)).toBe('700.00');
  });

  it('formats cents with a fractional part', () => {
    expect(centsToAmountText(968)).toBe('9.68');
  });

  it('round-trips with amountTextToCents', () => {
    expect(amountTextToCents(centsToAmountText(70000))).toBe(70000);
  });
});
