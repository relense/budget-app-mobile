// The fixed icon -> background-color palette for user-created expense categories: each icon
// has exactly one color, chosen once here (never picked independently by the user, per explicit
// product decision). Only the 16 expense-flavored icons from the backend's seed data are
// offered -- `briefcase`/`shield` are income-only there and are deliberately excluded.
//
// A distinct hex per icon, supplied directly (not sampled from mockups or invented) -- used
// as-is for the circle background, no opacity math on top, since the icon glyph itself is
// always rendered plain black (see CategoryIcon call sites in add-category.tsx/IconPicker.tsx)
// rather than tinted to match.
export const EXPENSE_ICON_PALETTE: { icon: string; color: string }[] = [
  { icon: 'cart', color: '#CEF3C8' },
  { icon: 'utensils', color: '#F3D9C8' },
  { icon: 'fuel', color: '#F3E8C8' },
  { icon: 'road', color: '#C8D3F3' },
  { icon: 'heart', color: '#F3C8C8' },
  { icon: 'star', color: '#EEF3C8' },
  { icon: 'book', color: '#C8E3F3' },
  { icon: 'shirt', color: '#DEC8F3' },
  { icon: 'coffee', color: '#F3C8D9' },
  { icon: 'gift', color: '#EEC8F3' },
  { icon: 'moon', color: '#CEC8F3' },
  { icon: 'plus-circle', color: '#C8F3D3' },
  { icon: 'cpu', color: '#C8F3F3' },
  { icon: 'file-text', color: '#C8F3E3' },
  { icon: 'car', color: '#DEF3C8' },
  { icon: 'gamepad', color: '#F3C8E9' },
];

const FALLBACK_COLOR = EXPENSE_ICON_PALETTE[0].color;

export function colorForIcon(icon: string): string {
  return EXPENSE_ICON_PALETTE.find((entry) => entry.icon === icon)?.color ?? FALLBACK_COLOR;
}
