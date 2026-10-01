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
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { usePottoColors } from '@/constants/potto-theme';
import { categoryColorHex, categoryLabel, categoryTint, type CategoryDisplay } from '@/logic/categories';

/** Controlled catalog: stored icon ids (see CATEGORY_ICON_IDS) → Lucide components. Unknown ids fall back to Tag. */
const ICONS: Record<string, LucideIcon> = {
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

export function CategoryGlyph({ icon, color, size = 16 }: { icon: string; color: string; size?: number }) {
  const Icon = ICONS[icon] ?? Tag;
  return <Icon size={size} color={color} strokeWidth={2} />;
}

/** Icon on a subtly tinted rounded square, tinted by the category's palette color. */
export function CategoryIcon({
  icon,
  color,
  size = 36,
}: {
  icon: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: categoryTint(color),
      }}>
      <CategoryGlyph icon={icon} color={categoryColorHex(color)} size={Math.round(size * 0.5)} />
    </View>
  );
}

/** Inline "[icon] Food & Dining" for rows and details. Not a pill — it should not dominate the row. */
export function CategoryBadge({ category, size = 12.5 }: { category: CategoryDisplay; size?: number }) {
  const colors = usePottoColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
      <CategoryGlyph
        icon={category.icon}
        color={category.uncategorized || category.archived ? colors.inkSoft : categoryColorHex(category.color)}
        size={size}
      />
      <Text numberOfLines={1} style={{ color: colors.inkSoft, fontSize: size, flexShrink: 1 }}>
        {categoryLabel(category)}
      </Text>
    </View>
  );
}
