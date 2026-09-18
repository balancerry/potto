import { cn } from '@/lib/utils';
import { type TextareaHTMLAttributes, forwardRef } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-24 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
