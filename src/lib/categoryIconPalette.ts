// The fixed icon -> background-color palette for user-created expense categories: each icon
// has exactly one color, chosen once here (never picked independently by the user, per explicit
// product decision). Only the 16 expense-flavored icons from the backend's seed data are
// offered -- `briefcase`/`shield` are income-only there and are deliberately excluded.
//
// These 7 hex values were supplied directly (not sampled from mockups or invented) -- used
// as-is for the circle background, no opacity math on top, since the icon glyph itself is
// always rendered plain black (see CategoryIcon call sites in add-category.tsx/IconPicker.tsx)
// rather than tinted to match.
const BACKGROUND_COLOR_CYCLE = [
  '#D2FFD8',
  '#FFCCDB',
  '#FFE945',
  '#F5D6FC',
  '#D6E3FC',
  '#FCE5D6',
  '#D6FCFC',
];

const EXPENSE_ICON_NAMES = [
  'cart',
  'utensils',
  'fuel',
  'road',
  'heart',
  'star',
  'book',
  'shirt',
  'coffee',
  'gift',
  'moon',
  'plus-circle',
  'cpu',
  'file-text',
  'car',
  'gamepad',
];

export const EXPENSE_ICON_PALETTE: { icon: string; color: string }[] = EXPENSE_ICON_NAMES.map(
  (icon, i) => ({ icon, color: BACKGROUND_COLOR_CYCLE[i % BACKGROUND_COLOR_CYCLE.length] }),
);

export function colorForIcon(icon: string): string {
  return (
    EXPENSE_ICON_PALETTE.find((entry) => entry.icon === icon)?.color ?? BACKGROUND_COLOR_CYCLE[0]
  );
}
