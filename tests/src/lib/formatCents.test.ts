import { formatCents } from '../../../src/lib/formatCents';

describe('formatCents', () => {
  it('formats whole euros with two decimal places', () => {
    expect(formatCents(2300)).toBe('€23.00');
  });

  it('formats cents with a thousands separator', () => {
    expect(formatCents(368600)).toBe('€3,686.00');
  });

  it('formats a single non-zero decimal digit as two decimals', () => {
    expect(formatCents(19420)).toBe('€194.20');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('€0.00');
  });

  it('formats negative amounts', () => {
    expect(formatCents(-500)).toBe('-€5.00');
  });
});
