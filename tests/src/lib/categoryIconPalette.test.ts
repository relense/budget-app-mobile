import {
  EXPENSE_ICON_PALETTE,
  INCOME_ICON_PALETTE,
  colorForIcon,
  colorForIncomeIcon,
} from '../../../src/lib/categoryIconPalette';

describe('EXPENSE_ICON_PALETTE', () => {
  it('has one entry per icon, no duplicate icon names', () => {
    const icons = EXPENSE_ICON_PALETTE.map((entry) => entry.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('gives every icon its own distinct color, no two icons sharing one', () => {
    const colors = EXPENSE_ICON_PALETTE.map((entry) => entry.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('gives every entry a 6-digit hex color', () => {
    for (const entry of EXPENSE_ICON_PALETTE) {
      expect(entry.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('colorForIcon', () => {
  it('returns exactly the matching palette entry for a known icon', () => {
    // Looks up the real entry rather than pinning a literal hex here -- the palette's own
    // values already got re-tuned twice in one session, and a hardcoded color in this test
    // would just mean chasing every tweak here too, without actually verifying the lookup
    // logic any better.
    const cartEntry = EXPENSE_ICON_PALETTE.find((entry) => entry.icon === 'cart');
    expect(cartEntry).toBeDefined();
    expect(colorForIcon('cart')).toBe(cartEntry!.color);
  });

  it('falls back to an allowed color for an unknown icon', () => {
    const allowedColors = new Set(EXPENSE_ICON_PALETTE.map((entry) => entry.color));
    expect(allowedColors.has(colorForIcon('not-a-real-icon'))).toBe(true);
  });
});

describe('INCOME_ICON_PALETTE', () => {
  it('offers exactly the two income-only icons (briefcase, shield)', () => {
    const icons = INCOME_ICON_PALETTE.map((entry) => entry.icon).sort();
    expect(icons).toEqual(['briefcase', 'shield']);
  });

  it('has one entry per icon, no duplicate icon names', () => {
    const icons = INCOME_ICON_PALETTE.map((entry) => entry.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('gives every icon its own distinct color, no two icons sharing one', () => {
    const colors = INCOME_ICON_PALETTE.map((entry) => entry.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('gives every entry a 6-digit hex color', () => {
    for (const entry of INCOME_ICON_PALETTE) {
      expect(entry.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('colorForIncomeIcon', () => {
  it('returns exactly the matching income palette entry for a known icon', () => {
    const briefcaseEntry = INCOME_ICON_PALETTE.find((entry) => entry.icon === 'briefcase');
    expect(briefcaseEntry).toBeDefined();
    expect(colorForIncomeIcon('briefcase')).toBe(briefcaseEntry!.color);
  });

  it('falls back to an allowed income color for an unknown icon', () => {
    const allowedColors = new Set(INCOME_ICON_PALETTE.map((entry) => entry.color));
    expect(allowedColors.has(colorForIncomeIcon('not-a-real-icon'))).toBe(true);
  });
});
