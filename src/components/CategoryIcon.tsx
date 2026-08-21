import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Category.icon (from the backend) is a library-agnostic semantic name -- "cart" means "show
// a cart", not "use this exact icon library's glyph name". This map is the one place that
// translates those semantic names to a specific icon library's own naming; swapping icon
// libraries later means editing this map, not every call site that renders a category icon.
// Names below come from the backend's defaultCategories.ts and prisma/seed.ts -- the full set
// currently in use. Anything not yet mapped falls back to a generic glyph rather than crashing.
const ICON_MAP: Record<string, IconName> = {
  cart: 'cart',
  utensils: 'silverware-fork-knife',
  fuel: 'gas-station',
  road: 'road-variant',
  heart: 'heart',
  star: 'star',
  book: 'book-open-variant',
  shirt: 'tshirt-crew',
  coffee: 'coffee',
  gift: 'gift',
  moon: 'weather-night',
  'plus-circle': 'plus-circle',
  cpu: 'chip',
  'file-text': 'file-document',
  briefcase: 'briefcase',
  shield: 'shield',
  car: 'car',
  gamepad: 'gamepad-variant',
};

const FALLBACK_ICON: IconName = 'help-circle-outline';

export function CategoryIcon({
  name,
  color,
  size = 22,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <MaterialCommunityIcons name={ICON_MAP[name] ?? FALLBACK_ICON} size={size} color={color} />
  );
}
