import { cn } from '@/lib/utils';
import { type HTMLAttributes } from 'react';

const tones = {
  default: 'bg-surface-sunk text-ink',
  accent: 'bg-accent-soft text-accent',
  pos: 'bg-pos-soft text-pos',
  neg: 'bg-neg-soft text-neg',
  gold: 'bg-gold-soft text-gold',
} as const;

export function Badge({
  className,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
