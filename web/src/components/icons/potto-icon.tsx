import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared Lucide treatment for Potto. Change stroke and sizes here. */
export function PottoIcon({
  icon: Icon,
  size = 18,
  className,
}: {
  icon: LucideIcon;
  size?: 16 | 18 | 20;
  className?: string;
}) {
  return <Icon size={size} strokeWidth={1.8} className={cn('shrink-0', className)} aria-hidden />;
}
