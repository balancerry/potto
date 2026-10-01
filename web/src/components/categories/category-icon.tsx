import {
  Bed,
  Camera,
  Car,
  Coffee,
  Ellipsis,
  Fuel,
  Gift,
  Heart,
  Landmark,
  Map,
  Music,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  Ticket,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import { categoryColorHex, categoryLabel, categoryTint, type CategoryDisplay } from '@/lib/core/logic/categories';
import { cn } from '@/lib/utils';

/** Controlled catalog: stored icon ids (see CATEGORY_ICON_IDS) → Lucide components. Unknown ids fall back to Tag. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  bed: Bed,
  sparkles: Sparkles,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  fuel: Fuel,
  ticket: Ticket,
  landmark: Landmark,
  heart: Heart,
  music: Music,
  camera: Camera,
  gift: Gift,
  coffee: Coffee,
  wine: Wine,
  plane: Plane,
  map: Map,
  tag: Tag,
  'more-horizontal': Ellipsis,
};

export function CategoryGlyph({ icon, color, size = 16 }: { icon: string; color?: string; size?: number }) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag;
  return <Icon size={size} strokeWidth={2} color={color} aria-hidden />;
}

/** Icon on a subtly tinted rounded square, tinted by the category's palette color. */
export function CategoryIcon({
  icon,
  color,
  size = 36,
  className,
}: {
  icon: string;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: categoryTint(color) }}
    >
      <CategoryGlyph icon={icon} color={categoryColorHex(color)} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** Inline "[icon] Food & Dining". Deliberately not a pill, so it never dominates a row. */
export function CategoryBadge({ category, className }: { category: CategoryDisplay; className?: string }) {
  const muted = category.uncategorized || category.archived;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 text-xs text-ink-soft', className)}>
      <CategoryGlyph icon={category.icon} color={muted ? undefined : categoryColorHex(category.color)} size={13} />
      <span className="truncate">{categoryLabel(category)}</span>
    </span>
  );
}
