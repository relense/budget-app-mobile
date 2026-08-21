import { todayIsoDate } from '../../../src/lib/today';

describe('todayIsoDate', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the local calendar date as YYYY-MM-DD', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 2)); // 2 September 2026, local time

    expect(todayIsoDate()).toBe('2026-09-02');
  });

  it('pads single-digit month and day', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 5)); // 5 January 2026, local time

    expect(todayIsoDate()).toBe('2026-01-05');
  });
});
