import { cn } from '@/lib/utils';
import { type LabelHTMLAttributes } from 'react';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block font-sans text-sm font-medium text-ink', className)}
      {...props}
    />
  );
}
