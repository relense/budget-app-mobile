import { EXPENSE_ICON_PALETTE, colorForIcon } from '../../../src/lib/categoryIconPalette';

const ALLOWED_COLORS = new Set([
  '#D2FFD8',
  '#FFCCDB',
  '#FFE945',
  '#F5D6FC',
  '#D6E3FC',
  '#FCE5D6',
  '#D6FCFC',
]);

describe('EXPENSE_ICON_PALETTE', () => {
  it('has one entry per icon, no duplicates', () => {
    const icons = EXPENSE_ICON_PALETTE.map((entry) => entry.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('only ever uses the supplied 7 background colors, never an invented one', () => {
    for (const entry of EXPENSE_ICON_PALETTE) {
      expect(ALLOWED_COLORS.has(entry.color)).toBe(true);
    }
  });
});

describe('colorForIcon', () => {
  it('returns the palette color for a known icon', () => {
    expect(colorForIcon('cart')).toBe('#D2FFD8');
  });

  it('falls back to an allowed color for an unknown icon', () => {
    expect(ALLOWED_COLORS.has(colorForIcon('not-a-real-icon'))).toBe(true);
  });
});
