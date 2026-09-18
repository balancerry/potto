import { cn } from '@/lib/utils';
import { type InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
